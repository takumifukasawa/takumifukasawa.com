// Dynamic resolution: give up pixels when frames run long, rather than running slowly.
//
// Tier 0 is exactly what params.json says, so this can only ever take quality AWAY. Nothing here can make
// the sketch look better than the saved values -- which is the point: the saved values are the intent, and
// this is the fallback for a device that cannot afford them.
//
// What it gives up is fill rate: resolution first, then the bloom resolution (a copy of
// lab/greeble-flow/quality.ts with the depth-of-field rung removed). Bloom resolution goes last because
// lowering it does not soften the image, it makes thin lights flicker (see TIERS).
import type { Params } from './params.ts';

export type Tier = { pixel: number; bloom: number };

// Bloom resolution is held until the last rung. It used to go first, on the theory that a blur's
// resolution is invisible -- true of the blur, not of the bright pass feeding it: below full resolution
// that pass samples the frame sparsely, thin lights are caught and missed on alternate frames, and the
// bloom flickers. That is a visible defect, not a softer image, so it is the last thing to give up.
const TIERS: Tier[] = [
  { pixel: 1, bloom: 1 },
  { pixel: 0.85, bloom: 1 },
  { pixel: 0.7, bloom: 0.75 },
  { pixel: 0.55, bloom: 0.5 },
];

export type Quality = {
  tier: number;
  ms: number; // smoothed frame time, which is also what the pane reads
  update: (deltaTime: number, params: Params) => Tier;
};

// Asymmetric on purpose. Dropping is a response to something the viewer is already seeing, so it is
// quick; climbing back is a guess that the load has gone away, so it is slow and gets slower every time
// the guess turns out to be wrong.
const DOWN_HOLD = 0.75;
const UP_HOLD = 4;
const WARMUP = 1.5; // the first frames are shader compilation and texture upload, not the steady state

// A frame longer than this is not a frame rate, it is a stall: the tab went to the background and rAF
// stopped, or the machine swapped, or a debugger paused. Feeding one of those to the average poisons it
// for dozens of frames -- long enough to walk several tiers down -- and the device was never slow. 200 ms
// is well past the worst real frame (5 fps) and well short of a backgrounded tab's seconds-long gaps.
const STALL_MS = 200;

export const createQuality = (): Quality => {
  let over = 0; // seconds spent above the budget
  let under = 0; // and below the climb-back threshold
  let upHold = UP_HOLD;
  let settle = WARMUP; // frames to ignore -- after a tier change the resolution switch is itself a hitch
  let lastTier = -1;

  const quality: Quality = {
    tier: 0,
    ms: 0,
    update: (deltaTime, params) => {
      const frameMs = deltaTime * 1000;

      // A hidden tab is not a slow one. Browsers throttle or stop rAF in the background, so the frames
      // either side of a visibility change are seconds long; without this the sketch quietly ratchets its
      // quality down every time it is tabbed away from, and the doubling cooldown means it stops coming
      // back. Re-settle on return rather than trusting the first frames after a resume.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        settle = Math.max(settle, 0.5);
        over = 0;
        under = 0;
        return TIERS[quality.tier]!;
      }

      // Smoothed, because one long frame (a GC, the pane redrawing itself) is not a reason to change the
      // resolution, and an unsmoothed signal would make this oscillate on its own. Stalls are discarded
      // outright rather than smoothed: averaging cannot tell a 2-second gap from sustained slowness.
      if (frameMs > STALL_MS) {
        settle = Math.max(settle, 0.5);
        over = 0;
        under = 0;
        return TIERS[quality.tier]!;
      }
      quality.ms += (frameMs - quality.ms) * 0.1;

      if (settle > 0) {
        settle -= deltaTime;
        over = 0;
        under = 0;
        // Seed the average from the real frame time instead of climbing to it from zero, or the first
        // second after every tier change reads as fast no matter what the device is doing.
        if (settle <= 0) quality.ms = frameMs;
        return TIERS[quality.tier]!;
      }

      if (params.autoQuality < 0.5) {
        quality.tier = 0;
        over = 0;
        under = 0;
        return TIERS[0]!;
      }

      const down = params.qualityMs;
      // The dead band between the two thresholds is what keeps a device sitting at the edge from
      // flapping: at 24 ms it steps down below 42 fps and only steps back up above 58.
      const up = down * 0.72;

      if (quality.ms > down) {
        over += deltaTime;
        under = 0;
      } else if (quality.ms < up) {
        under += deltaTime;
        over = 0;
      } else {
        over = 0;
        under = 0;
      }

      if (over >= DOWN_HOLD && quality.tier < TIERS.length - 1) {
        quality.tier++;
        // If this undoes a climb, that climb was wrong: wait longer before trying again. Doubling means a
        // device that genuinely cannot hold tier 0 stops being asked after a few minutes, instead of
        // visibly stepping up and down forever.
        if (quality.tier === lastTier) upHold *= 2;
        settle = 0.5;
        over = 0;
      } else if (under >= upHold && quality.tier > 0) {
        lastTier = quality.tier;
        quality.tier--;
        settle = 0.5;
        under = 0;
      }

      return TIERS[quality.tier]!;
    },
  };

  return quality;
};
