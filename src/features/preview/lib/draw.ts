import type { Grid } from "../../../shared/document";
export function drawGrid(
  canvas: HTMLCanvasElement,
  grid: Grid,
  color: boolean,
  background: string,
) {
  canvas.width = grid.columns * 8;
  canvas.height = grid.rows * 16;
  const g = canvas.getContext("2d")!;
  g.fillStyle = background;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = "14px monospace";
  g.textBaseline = "middle";
  g.textAlign = "center";
  for (let i = 0; i < grid.cells.length; i++) {
    const c = grid.cells[i]!;
    g.fillStyle = color ? c.color : "#e9eceb";
    g.fillText(
      c.glyph,
      (i % grid.columns) * 8 + 4,
      Math.floor(i / grid.columns) * 16 + 8,
    );
  }
}
