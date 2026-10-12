// When each block rises, and the shape of the rise.
//
// Two separate decisions, and they are easy to confuse:
//   - cellDelay: WHICH blocks go first. This carries the motion. Distance from the centre reads as a
//     shockwave; a pure hash reads as static; the two mixed reads as a wave through a real structure.
//   - growth:    the per-block curve. Linear reads mechanical; ease-out reads pneumatic; overshooting
//     past full height and settling reads as something locking into place.
//
// Everything is a function of (time, delay) with no integration and no stored velocity, and the curve is
// **0 at both ends of the cycle**. That is what makes the recording loop exactly: a stateless phase
// function closes, an integrated one never quite does (decision 0005).
import { hashCell } from './hash.ts';
import type { Params } from './params.ts';
import type { Cell } from './subdivide.ts';

const fract = (v: number) => v - Math.floor(v);

// Phase offset within the loop, 0..1.
export const cellDelay = (cell: Cell, params: Params): number => {
  const cx = cell.x + cell.w / 2;
  const cz = cell.z + cell.d / 2;
  // Normalised by the half-diagonal, so the far corners land at ~1 whatever the field size is.
  const radius = Math.hypot(cx, cz) / (params['size'] * 0.71);
  // Mostly radial, with enough hash to break the perfect rings -- otherwise it is a ripple in water.
  const jitter = hashCell(cell, params['seed'] + 7777);
  return fract((radius * 0.75 + jitter * 0.25) * params['spread']);
};

// 0 at rest, 1 at full height. t is seconds since the sketch started.
export const growth = (t: number, delay: number, params: Params): number => {
  const local = fract(t / params['loopPeriod'] - delay);
  const rise = params['rise'];
  const fall = params['fall'];

  if (local < rise) {
    const u = local / rise;
    // ease-out-back. c3 is fixed to c1 + 1 so the curve passes through exactly 0 at u=0 and 1 at u=1
    // whatever the overshoot is -- that identity is what keeps the loop seamless.
    const c1 = 1.70158 * params['overshoot'];
    const c3 = c1 + 1;
    return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
  }

  if (local > 1 - fall) {
    // Cubic back to 0, and shorter than the rise, so the field spends most of the loop standing.
    const u = (local - (1 - fall)) / fall;
    return 1 - u * u * u;
  }

  return 1;
};
