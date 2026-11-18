export function tone(
  value: number,
  contrast: number,
  gamma: number,
  invert: boolean,
): number {
  let t = Math.max(0, Math.min(1, (value / 255 - 0.5) * contrast + 0.5));
  t = Math.pow(t, 1 / gamma);
  return invert ? 1 - t : t;
}
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
