// The *schema* of the knobs lives here. The *values* live in params.json, which the save button in the
// debug pane writes. Nothing in this file is a value, so tuning the sketch never produces a code diff --
// and the committed build and the ?clean recording read the same file the pane wrote.
//
// Quoted keys throughout: terser mangles unquoted property names in the build, and these are read by
// string (Tweakpane bindings, JSON keys). See the note in vite.config.ts.
// The import attribute is required by Node and accepted by Vite, so params.ts can also be imported from a
// plain `node script.ts` -- which is how the loop is verified numerically (the browser cannot be trusted to
// animate at all in an automated tab; docs/learnings.md 2026-10-12).
import saved from './params.json' with { type: 'json' };

// One table, three consumers: the Params type, the pane (debug.ts) and the completeness check below.
// Every knob is a number -- keep it that way, or Params collapses to Record<string, unknown>.
export const SCHEMA = {
  // footprints (subdivide.ts)
  'size': { 'folder': 'footprints', 'min': 4, 'max': 64, 'step': 1 }, // extent of the UV domain, not of the world
  'depth': { 'folder': 'footprints', 'min': 0, 'max': 16, 'step': 1 }, // cell count is bounded by 2^depth
  'minSide': { 'folder': 'footprints', 'min': 0.05, 'max': 2, 'step': 0.01 }, // no cut may leave a side shorter
  'maxSide': { 'folder': 'footprints', 'min': 0.2, 'max': 24, 'step': 0.1 }, // a leaf wider than this keeps splitting
  'splitBias': { 'folder': 'footprints', 'min': 0, 'max': 1, 'step': 0.01 }, // 0 = every cut halves; 1 = down to 1:9
  'stopChance': { 'folder': 'footprints', 'min': 0, 'max': 0.6, 'step': 0.01 }, // early stop -- makes density uneven
  'holeChance': { 'folder': 'footprints', 'min': 0, 'max': 0.5, 'step': 0.01 }, // drops a leaf, leaving a gap
  'seed': { 'folder': 'footprints', 'min': 1, 'max': 999, 'step': 1 },
  // heights (height.ts)
  'heightMin': { 'folder': 'heights', 'min': 0, 'max': 2, 'step': 0.01 },
  'heightMax': { 'folder': 'heights', 'min': 0.1, 'max': 12, 'step': 0.1 },
  'spikeRate': { 'folder': 'heights', 'min': 0, 'max': 0.5, 'step': 0.005 }, // fraction of small cells that mast
  'spikeBoost': { 'folder': 'heights', 'min': 0, 'max': 5, 'step': 0.05 }, // how far past heightMax a mast goes
  'storeys': { 'folder': 'heights', 'min': 0, 'max': 24, 'step': 1 }, // quantise heights (0 = continuous)
  'gap': { 'folder': 'heights', 'min': 0, 'max': 0.4, 'step': 0.01 }, // shrink so neighbours do not touch
  // timing (growth.ts)
  'loopPeriod': { 'folder': 'motion', 'min': 2, 'max': 30, 'step': 0.5 }, // seconds for one rise/hold/fall cycle
  'spread': { 'folder': 'motion', 'min': 0, 'max': 1, 'step': 0.01 }, // phase spread across the field
  'rise': { 'folder': 'motion', 'min': 0.02, 'max': 0.6, 'step': 0.01 }, // fraction of the period spent rising
  'fall': { 'folder': 'motion', 'min': 0.02, 'max': 0.6, 'step': 0.01 }, // fraction spent sinking back
  'overshoot': { 'folder': 'motion', 'min': 0, 'max': 3, 'step': 0.05 }, // how far the rise goes past full height
  // body (surface.ts) -- the UV domain above is wrapped onto this
  'radius': { 'folder': 'body', 'min': 1, 'max': 20, 'step': 0.1 },
  'lumps': { 'folder': 'body', 'min': 0, 'max': 0.6, 'step': 0.01 }, // how far from a sphere
  'lumpScale': { 'folder': 'body', 'min': 0.5, 'max': 8, 'step': 0.1 }, // size of the lumps
  'breathe': { 'folder': 'body', 'min': 0, 'max': 0.3, 'step': 0.005 }, // amplitude of the pulse
  // look (blocks.ts, main.ts)
  'barAspect': { 'folder': 'look', 'min': 1, 'max': 12, 'step': 0.1 }, // how elongated a cell must be to glow
  'barRate': { 'folder': 'look', 'min': 0, 'max': 1, 'step': 0.01 }, // fraction of those that actually do
  'barHeight': { 'folder': 'look', 'min': 0.02, 'max': 1, 'step': 0.01 }, // bars stay flat; 1 = same as the mass
  'emissive': { 'folder': 'look', 'min': 0, 'max': 20, 'step': 0.1 }, // bar brightness; this is what bloom picks up
  'exposure': { 'folder': 'look', 'min': 0.1, 'max': 4, 'step': 0.05 },
  'camSwing': { 'folder': 'look', 'min': 0, 'max': 1.2, 'step': 0.01 }, // radians the camera swings per loop
  // Lighting and fog, as multiples of `size` where they are distances, so they survive a change of scale.
  // All live: the look is tuned by eye from the pane, and a rebuild per slider drag makes that unusable.
  'keyLight': { 'folder': 'light', 'min': 0, 'max': 12, 'step': 0.1 },
  'rimLight': { 'folder': 'light', 'min': 0, 'max': 12, 'step': 0.1 },
  'ambient': { 'folder': 'light', 'min': 0, 'max': 4, 'step': 0.05 }, // hemisphere + environment together
  'fogNear': { 'folder': 'light', 'min': 0.1, 'max': 6, 'step': 0.05 },
  'fogFar': { 'folder': 'light', 'min': 0.5, 'max': 12, 'step': 0.1 },
  // post (post.ts)
  'bloomStrength': { 'folder': 'post', 'min': 0, 'max': 3, 'step': 0.01 },
  'bloomRadius': { 'folder': 'post', 'min': 0, 'max': 2, 'step': 0.01 },
  'bloomThreshold': { 'folder': 'post', 'min': 0, 'max': 2, 'step': 0.01 },
  'aberration': { 'folder': 'post', 'min': 0, 'max': 0.2, 'step': 0.002 }, // UV offset at the corners, so tiny
  // Depth of field. 0 aperture disables the pass entirely -- it costs a second geometry pass (see post.ts).
  'dofAperture': { 'folder': 'post', 'min': 0, 'max': 3, 'step': 0.05 },
  'dofFocus': { 'folder': 'post', 'min': 0.2, 'max': 4, 'step': 0.02 }, // focal distance, as a multiple of size
  'dofMaxBlur': { 'folder': 'post', 'min': 0, 'max': 0.03, 'step': 0.001 },
  // The biggest lever on a phone. Post is fill-rate bound (the DOF blur alone is 41 taps per pixel), and a
  // modern phone reports devicePixelRatio 3, so the cap here decides how many pixels all of that runs over.
  // Capped against the device's own ratio, never multiplied past it.
  'pixelRatio': { 'folder': 'perf', 'min': 0.5, 'max': 2, 'step': 0.1 }
} as const;

export type ParamKey = keyof typeof SCHEMA;
export type Params = Record<ParamKey, number>;

// Knobs the render loop reads every frame. Everything NOT listed here feeds data that is computed once per
// rebuild (footprints, heights, per-cell delays, materials), so changing it has to rebuild the field.
// `spread` looks like motion but feeds the precomputed delays, so it is deliberately absent.
export const LIVE_KEYS: ParamKey[] = [
  'loopPeriod', 'rise', 'fall', 'overshoot',
  'exposure', 'camSwing',
  'radius', 'lumps', 'lumpScale', 'breathe',
  'keyLight', 'rimLight', 'ambient', 'fogNear', 'fogFar',
  'bloomStrength', 'bloomRadius', 'bloomThreshold', 'aberration',
  'dofAperture', 'dofFocus', 'dofMaxBlur', 'pixelRatio',
];

export const loadParams = (): Params => {
  const values = saved as Record<string, unknown>;
  const missing = (Object.keys(SCHEMA) as ParamKey[]).filter((key) => typeof values[key] !== 'number');
  // Loud and early: a missing key would otherwise reach the geometry as NaN and render nothing at all.
  if (missing.length > 0) throw new Error(`params.json is missing or non-numeric: ${missing.join(', ')}`);
  return { ...(values as Params) };
};
