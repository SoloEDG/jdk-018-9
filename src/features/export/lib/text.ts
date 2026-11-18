import type { Grid } from "../../../shared/document";
export function textContent(grid: Grid): string {
  return Array.from({ length: grid.rows }, (_, y) =>
    grid.cells
      .slice(y * grid.columns, (y + 1) * grid.columns)
      .map((c) => c.glyph)
      .join(""),
  ).join("\n");
}
