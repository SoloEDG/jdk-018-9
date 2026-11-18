import type { Crop } from "../../../shared/document";
export function normalizeCrop(c: Crop): Crop {
  const x = Math.max(0, Math.min(0.99, c.x));
  const y = Math.max(0, Math.min(0.99, c.y));
  return {
    x,
    y,
    width: Math.max(0.01, Math.min(1 - x, c.width)),
    height: Math.max(0.01, Math.min(1 - y, c.height)),
  };
}
export function cropFromPoints(
  x: number,
  y: number,
  ex: number,
  ey: number,
): Crop {
  return normalizeCrop({
    x: Math.min(x, ex),
    y: Math.min(y, ey),
    width: Math.abs(ex - x),
    height: Math.abs(ey - y),
  });
}
