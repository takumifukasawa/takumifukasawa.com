// Cheap 32-bit mix of a cell's identity -> 0..1.
//
// Shared by height and timing because both need the same property, and it is the property that makes this
// greeble rather than landscape: **neighbouring cells must land on unrelated values**. Value noise or fBm
// here would give neighbours similar results and the field would immediately read as terrain.
import type { Rect } from './subdivide.ts';

export const hashCell = (cell: Rect, salt: number): number => {
  // The centre, not the corner: two cells can share a corner but never a centre.
  let h = Math.imul(salt | 0, 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ Math.round((cell.x + cell.w / 2) * 97), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ Math.round((cell.z + cell.d / 2) * 131), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
