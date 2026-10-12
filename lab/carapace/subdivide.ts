// Footprints. THE subject of this sketch -- greeble is the *distribution of footprints* more than the
// extrusion, so this is the file that decides whether it reads as greeble at all.
//
// Target, read off the Unity 6 key art: a strict Manhattan grid where long thin rectangles sit next to
// small squares, with no uniform cell size anywhere. Recursive rectangular subdivision (BSP) produces that;
// a regular grid or Voronoi does not.
//
// Four things decide the look, in order of impact:
//   1. which axis gets cut   -- the longer one, mostly: that is what stops cells degenerating into slivers
//   2. where the cut lands   -- away from the middle: this is the "long rectangle beside a small box" look
//   3. when to stop          -- a fixed depth makes density uniform; stopping at random makes it vary
//   4. which cells survive   -- dropping some leaves the streets and clearings between clusters
import type { Params } from './params.ts';

// One footprint: an axis-aligned rectangle on the ground plane, plus the recursion depth it stopped at.
export type Cell = { x: number; z: number; w: number; d: number; depth: number };

// mulberry32. Deterministic, so a seed reproduces a field exactly and a recording can be reshot.
const createRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Split the ground plane into footprints. Called once per rebuild, never per frame.
export const subdivide = (params: Params): Cell[] => {
  const rnd = createRandom(params['seed']);
  const minSide = params['minSide'];
  const maxDepth = params['depth'];
  const bias = params['splitBias'];
  const cells: Cell[] = [];

  const recurse = (x: number, z: number, w: number, d: number, depth: number) => {
    // An axis is cuttable only if both halves can still clear minSide. Checking per axis (rather than
    // checking the longer side and hoping) is what keeps slivers out of the result entirely.
    const canX = w >= minSide * 2;
    const canZ = d >= minSide * 2;

    // A cell wider than maxSide is not allowed to stop, whatever the coin flip says. On a curved surface
    // this is not cosmetic: a box is flat, so a cell spanning a big arc becomes a chord that cuts straight
    // through the body. Capping the leaf size is what keeps the panels on the skin.
    const tooBig = Math.max(w, d) > params['maxSide'];

    // Stop: out of budget, nothing left to cut, or a coin flip. The coin flip is the one that matters --
    // a pure depth limit gives a field of suspiciously similar cells.
    //
    // maxSide overrides the depth budget as well as the coin flip. It is a geometric constraint, not a
    // taste one, and `depth` is only a budget: with an unlucky chain of uneven splits a cell can still be
    // large at maxDepth, and on a curved surface that one cell is a slab stabbing through the body.
    // Termination is still guaranteed -- every split removes at least minSide, and (!canX && !canZ) always wins.
    if ((!tooBig && depth >= maxDepth) || (!canX && !canZ) || (!tooBig && depth > 0 && rnd() < params['stopChance'])) {
      if (rnd() >= params['holeChance']) cells.push({ x, z, w, d, depth });
      return;
    }

    // Cut the longer side 85% of the time. Always cutting it combs the field into stripes; never doing so
    // lets cells drift into slivers. The minority case is what makes the grid look built rather than grown.
    let alongX: boolean;
    if (canX && canZ) alongX = w > d ? rnd() > 0.15 : rnd() < 0.15;
    else alongX = canX;

    const t = 0.5 + (rnd() - 0.5) * bias;

    if (alongX) {
      const cut = Math.min(Math.max(w * t, minSide), w - minSide);
      recurse(x, z, cut, d, depth + 1);
      recurse(x + cut, z, w - cut, d, depth + 1);
    } else {
      const cut = Math.min(Math.max(d * t, minSide), d - minSide);
      recurse(x, z, w, cut, depth + 1);
      recurse(x, z + cut, w, d - cut, depth + 1);
    }
  };

  const size = params['size'];
  recurse(-size / 2, -size / 2, size, size, 0);
  return cells;
};
