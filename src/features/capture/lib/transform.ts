export interface Pt {
  x: number;
  y: number;
}
/**
 * 2D 变换：
 * - linear: x' = a·x + c·y + e, y' = b·x + d·y + f（相似/仿射共用 6 参数）
 * - homo: 3×3 单应矩阵（四点及以上透视校准）
 */
export type Transform =
  | { kind: "linear"; m: [number, number, number, number, number, number] }
  | {
      kind: "homo";
      h: [number, number, number, number, number, number, number, number, number];
    };

/** 高斯消元（部分主元）解 n×n 线性方程组，奇异时返回 null */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    if (Math.abs(M[piv]![col]!) < 1e-12) return null;
    const tmp = M[col]!;
    M[col] = M[piv]!;
    M[piv] = tmp;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / M[col]![col]!;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r]![c]! -= f * M[col]![c]!;
    }
  }
  return M.map((row, i) => row[n]! / M[i]![i]!);
}

/**
 * 由对应点拟合变换：src → dst。
 * 2 点 → 相似变换；3 点 → 仿射；4 点 → 单应（透视）。不足 2 点返回 null。
 */
export function fitTransform(src: Pt[], dst: Pt[]): Transform | null {
  const n = Math.min(src.length, dst.length);
  if (n < 2) return null;
  if (n === 2) {
    const [s0, s1] = [src[0]!, src[1]!];
    const [d0, d1] = [dst[0]!, dst[1]!];
    const dx = s1.x - s0.x,
      dy = s1.y - s0.y;
    const ex = d1.x - d0.x,
      ey = d1.y - d0.y;
    const denom = dx * dx + dy * dy;
    if (denom < 1e-12) return null;
    const a = (dx * ex + dy * ey) / denom;
    const b = (dx * ey - dy * ex) / denom;
    return {
      kind: "linear",
      m: [a, b, -b, a, d0.x - (a * s0.x - b * s0.y), d0.y - (b * s0.x + a * s0.y)],
    };
  }
  if (n === 3) {
    const A: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 3; i++) {
      const s = src[i]!,
        d = dst[i]!;
      A.push([s.x, s.y, 1, 0, 0, 0]);
      y.push(d.x);
      A.push([0, 0, 0, s.x, s.y, 1]);
      y.push(d.y);
    }
    const p = solveLinear(A, y);
    if (!p) return null;
    return {
      kind: "linear",
      m: [p[0]!, p[3]!, p[1]!, p[4]!, p[2]!, p[5]!],
    };
  }
  const A: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i]!,
      d = dst[i]!;
    A.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]);
    y.push(d.x);
    A.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]);
    y.push(d.y);
  }
  const p = solveLinear(A, y);
  if (!p) return null;
  return { kind: "homo", h: [p[0]!, p[1]!, p[2]!, p[3]!, p[4]!, p[5]!, p[6]!, p[7]!, 1] };
}

export function applyTransform(t: Transform, p: Pt): Pt {
  if (t.kind === "linear") {
    const [a, b, c, d, e, f] = t.m;
    return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
  }
  const h = t.h;
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (Math.abs(w) < 1e-12) return p;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/** 求逆变换；不可逆时返回 null */
export function invertTransform(t: Transform): Transform | null {
  if (t.kind === "linear") {
    const [a, b, c, d, e, f] = t.m;
    const det = a * d - c * b;
    if (Math.abs(det) < 1e-12) return null;
    const na = d / det,
      nb = -b / det,
      nc = -c / det,
      nd = a / det;
    return {
      kind: "linear",
      m: [na, nb, nc, nd, -(na * e + nc * f), -(nb * e + nd * f)],
    };
  }
  const [a, b, c, d, e, f, g, h, i] = t.h;
  const A = e * i - f * h,
    B = -(d * i - f * g),
    C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv: [number, number, number, number, number, number, number, number, number] = [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
  return { kind: "homo", h: inv };
}
