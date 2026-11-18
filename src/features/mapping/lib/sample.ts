import type { Asset, Crop } from "../../../shared/document";
export function sample(
  asset: Asset,
  crop: Crop,
  columns: number,
  rows: number,
  background: string,
): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = columns;
  c.height = rows;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = background;
  g.fillRect(0, 0, columns, rows);
  g.drawImage(
    asset.image,
    crop.x * asset.width,
    crop.y * asset.height,
    crop.width * asset.width,
    crop.height * asset.height,
    0,
    0,
    columns,
    rows,
  );
  return g.getImageData(0, 0, columns, rows).data;
}
