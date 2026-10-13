// Dynamic resolution: give up pixels when frames run long, rather than running slowly.
//
// Tier 0 is exactly what params.json says, so this can only ever take quality AWAY. Nothing here can make
// the sketch look better than the saved values -- which is the point: the saved values are the intent, and
// this is the fallback for a device that cannot afford them.
//
// What it gives up, in the order it gives it up, is fill rate: resolution first, then the bloom pyramid,
// then depth of field. That order is not arbitrary. Post is fill-rate bound (the DOF blur alone is 41 taps
// per pixel), so resolution is the biggest lever per unit of visible change; the bloom pyramid is a blur
// and its resolution is invisible; DOF is last because losing it is the only one of the three that changes
// the composition rather than its sharpness.
//
// NOT geometry. flowTrail and flowCount would also help, but both rebuild buffers, and a device already
// missing its frame deadline is the worst possible moment to allocate.
import type { Params } from './params.ts';

export type Tier = { 'pixel': number; 'bloom': number; 'dof': boolean };

const TIERS: Tier[] = [
  { 'pixel': 1, 'bloom': 1, 'dof': true },
  { 'pixel': 0.85, 'bloom': 0.75, 'dof': true },
  { 'pixel': 0.7, 'bloom': 0.5, 'dof': true },
  { 'pixel': 0.7, 'bloom': 0.5, 'dof': false },
  { 'pixel': 0.55, 'bloom': 0.4, 'dof': false },
];

export type Quality = {
  'tier': number;
  'ms': number; // smoothed frame time, which is also what the pane reads
  'update': (deltaTime: number, params: Params) => Tier;
};

// Asymmetric on purpose. Dropping is a response to something the viewer is already seeing, so it is
// quick; climbing back is a guess that the load has gone away, so it is slow and gets slower every time
// the guess turns out to be wrong.
const DOWN_HOLD = 0.75;
const UP_HOLD = 4;
const WARMUP = 1.5; // the first frames are shader compilation and texture upload, not the steady state

export const createQuality = (): Quality => {
  let over = 0; // seconds spent above the budget
  let under = 0; // and below the climb-back threshold
  let upHold = UP_HOLD;
  let settle = WARMUP; // frames to ignore -- after a tier change the resolution switch is itself a hitch
  let lastTier = -1;

  const quality: Quality = {
    'tier': 0,
    'ms': 0,
    'update': (deltaTime, params) => {
      const frameMs = deltaTime * 1000;
      // Smoothed, because one long frame (a GC, the pane redrawing itself) is not a reason to change the
      // resolution, and an unsmoothed signal would make this oscillate on its own.
      quality['ms'] += (frameMs - quality['ms']) * 0.1;

      if (settle > 0) {
        settle -= deltaTime;
        over = 0;
        under = 0;
        // Seed the average from the real frame time instead of climbing to it from zero, or the first
        // second after every tier change reads as fast no matter what the device is doing.
        if (settle <= 0) quality['ms'] = frameMs;
        return TIERS[quality['tier']]!;
      }

      if (params['autoQuality'] < 0.5) {
        quality['tier'] = 0;
        over = 0;
        under = 0;
        return TIERS[0]!;
      }

      const down = params['qualityMs'];
      // The dead band between the two thresholds is what keeps a device sitting at the edge from
      // flapping: at 24 ms it steps down below 42 fps and only steps back up above 58.
      const up = down * 0.72;

      if (quality['ms'] > down) {
        over += deltaTime;
        under = 0;
      } else if (quality['ms'] < up) {
        under += deltaTime;
        over = 0;
      } else {
        over = 0;
        under = 0;
      }

      if (over >= DOWN_HOLD && quality['tier'] < TIERS.length - 1) {
        quality['tier']++;
        // If this undoes a climb, that climb was wrong: wait longer before trying again. Doubling means a
        // device that genuinely cannot hold tier 0 stops being asked after a few minutes, instead of
        // visibly stepping up and down forever.
        if (quality['tier'] === lastTier) upHold *= 2;
        settle = 0.5;
        over = 0;
      } else if (under >= upHold && quality['tier'] > 0) {
        lastTier = quality['tier'];
        quality['tier']--;
        settle = 0.5;
        under = 0;
      }

      return TIERS[quality['tier']]!;
    },
  };

  return quality;
};
