// The grid: which cells are solid (from shape.ts), and which of those are on the surface -- solid with an empty
// neighbor or the grid's edge next to them. Only surface cells are drawn; the wave lives in every solid cell.
import { inside } from './shape.ts';

export type Cells = {
  n: number;
  // 1 = solid, per cell, indexed by cellIndex.
  solid: Uint8Array;
  // cellIndex of each surface cell, in instance order.
  surface: Uint32Array;
};

export const cellIndex = (n: number, x: number, y: number, z: number) => x + n * (y + n * z);

export const createCells = (n: number): Cells => {
  const solid = new Uint8Array(n * n * n);
  for (let z = 0; z < n; z++)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) solid[cellIndex(n, x, y, z)] = inside(x, y, z, n) ? 1 : 0;

  const at = (x: number, y: number, z: number) =>
    x >= 0 && y >= 0 && z >= 0 && x < n && y < n && z < n && solid[cellIndex(n, x, y, z)] === 1;
  const surface: number[] = [];
  for (let z = 0; z < n; z++)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (!at(x, y, z)) continue;
        if (at(x - 1, y, z) && at(x + 1, y, z) && at(x, y - 1, z) && at(x, y + 1, z) && at(x, y, z - 1) && at(x, y, z + 1)) continue;
        surface.push(cellIndex(n, x, y, z));
      }
  return { n, solid, surface: Uint32Array.from(surface) };
};
