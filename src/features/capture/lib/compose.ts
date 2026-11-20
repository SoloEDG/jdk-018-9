import type { CalibrationAnchor, Crop } from "../../../shared/document";
import { artToFrameMapper, regionAspect } from "./calibration";
import type { Pt } from "./transform";

/** 一路的定格输入：原始帧画布 + 该路的校准依据 */
export interface ComposeChannel {
  canvas: HTMLCanvasElement;
  mirror: boolean;
  crop: Crop;
  anchors: CalibrationAnchor[];
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [16, 18, 22];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function sampleBilinear(data: ImageData, fx: number, fy: number): [number, number, number] {
  const x = Math.min(Math.max(fx, 0), data.width - 1.001);
  const y = Math.min(Math.max(fy, 0), data.height - 1.001);
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const tx = x - x0,
    ty = y - y0;
  const w = data.width;
  const i00 = (y0 * w + x0) * 4,
    i10 = i00 + 4,
    i01 = i00 + w * 4,
    i11 = i01 + 4;
  const d = data.data;
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const top = d[i00 + k]! * (1 - tx) + d[i10 + k]! * tx;
    const bottom = d[i01 + k]! * (1 - tx) + d[i11 + k]! * tx;
    out[k] = Math.round(top * (1 - ty) + bottom * ty);
  }
  return out;
}

/**
 * 由定格帧合成作品图。
 * 每一路：作品区域坐标 → 校准变换 → 原始帧坐标采样。
 * 镜像只影响作品呈现方向，采样位置始终在原始帧坐标系中求得：
 * - 无锚点时，按镜像翻转作品横坐标，使作品与镜像预览一致；
 * - 锚点生效时，锚点是在镜像预览上标定的，映射本身已包含方向，不再翻转。
 */
export function composeArtwork(
  mode: "compare" | "stitch" | "single",
  left: ComposeChannel | null,
  right: ComposeChannel | null,
  background: string,
  maxWidth = 1440,
): HTMLCanvasElement {
  const channels = [left, right].filter((c): c is ComposeChannel => !!c);
  if (!channels.length) throw new Error("没有可合成的画面");
  const aspects = channels.map((c) =>
    regionAspect(c, c.canvas.width, c.canvas.height),
  );
  const gutter = mode === "compare" && channels.length === 2 ? 0.03 : 0;
  const totalAspect = aspects.reduce((a, b) => a + b, 0) + gutter;

  const outW = Math.max(64, Math.round(maxWidth));
  const outH = Math.min(4096, Math.max(32, Math.round(outW / totalAspect)));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = g.createImageData(outW, outH);
  const [br, bg, bb] = hexToRgb(background);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = br;
    img.data[i + 1] = bg;
    img.data[i + 2] = bb;
    img.data[i + 3] = 255;
  }

  let offset = 0;
  for (let idx = 0; idx < channels.length; idx++) {
    const ch = channels[idx]!;
    const unitW = aspects[idx]! / totalAspect;
    const rx = Math.round(offset * outW);
    const rw = Math.max(1, Math.round((offset + unitW) * outW) - rx);
    offset += unitW + (idx === 0 ? gutter : 0);

    const src = ch.canvas
      .getContext("2d", { willReadFrequently: true })!
      .getImageData(0, 0, ch.canvas.width, ch.canvas.height);
    const map = artToFrameMapper(ch);
    const flip = ch.mirror && ch.anchors.length < 2;
    const fw = src.width - 1,
      fh = src.height - 1;
    for (let py = 0; py < outH; py++) {
      const v = (py + 0.5) / outH;
      let di = (py * outW + rx) * 4;
      for (let px = 0; px < rw; px++, di += 4) {
        const u = (px + 0.5) / rw;
        const art: Pt = flip ? { x: 1 - u, y: v } : { x: u, y: v };
        const f = map(art);
        const [r, gg, b] = sampleBilinear(src, f.x * fw, f.y * fh);
        img.data[di] = r;
        img.data[di + 1] = gg;
        img.data[di + 2] = b;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}
