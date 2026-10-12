// How tall each footprint extrudes.
//
// The reference reads as a per-cell hash, not noise: neighbouring blocks have unrelated heights, so the
// field looks like machinery rather than terrain. See hash.ts for why that distinction is the whole game.
import { hashCell } from './hash.ts';
import type { Params } from './params.ts';
import type { Cell } from './subdivide.ts';

// Keyed on the PLATE, not the leaf: every leaf of a plate gets the same height, so a group of adjacent
// boxes reads as one panel instead of as independent confetti (subdivide.ts).
export const cellHeight = (cell: Cell, params: Params): number => {
  const plate = cell.plate;
  const h = hashCell(plate, params['seed']);

  // Squared, not linear. A flat distribution gives a plateau with a uniform skyline, which is the single
  // easiest way to lose the greeble read -- what is wanted is a low mass with a few things out of it.
  let v = params['heightMin'] + (params['heightMax'] - params['heightMin']) * h * h;

  // Masts: a few small footprints shoot well past the mass, and that is what reads as antennae and pipes
  // rather than buildings. Only a *fraction* of the small cells -- boosting every one turns the field into
  // a bed of needles, which is a different and much worse object. (Learned by doing exactly that.)
  const small = plate.w * plate.d < params['plateSize'] * params['plateSize'] * 0.09;
  const pick = hashCell(plate, params['seed'] ^ 0x5bf03635);
  const rate = params['spikeRate'];
  if (small && pick < rate) {
    v = params['heightMax'] * (1 + params['spikeBoost']) * (0.5 + (pick / Math.max(rate, 1e-6)) * 0.5);
  }

  // Quantising to storeys puts the tops on shared planes, which reads as manufactured. Continuous heights
  // read as organic, which is the wrong family.
  const storeys = params['storeys'];
  if (storeys > 0) {
    const step = params['heightMax'] / storeys;
    // Floor at heightMin, not at one storey: flooring at a storey silently overrides heightMin and the
    // flattest blocks all jump to the same height, which kills the low mass the masts stand against.
    v = Math.max(params['heightMin'], Math.round(v / step) * step);
  }
  return v;
};
