// The *schema* of the knobs lives here. The *values* live in params.json, which the save button in the
// debug pane writes. Nothing in this file is a value, so tuning the sketch never produces a code diff --
// and the committed build and the ?clean recording read the same file the pane wrote.
//
// Quoted keys throughout: terser mangles unquoted property names in the build, and these are read by
// string (Tweakpane bindings, JSON keys). See the note in vite.config.ts.
import saved from './params.json';

// One table, three consumers: the Params type, the pane (debug.ts) and the completeness check below.
// Every knob is a number -- keep it that way, or Params collapses to Record<string, unknown>.
export const SCHEMA = {
  // footprints (subdivide.ts)
  'size': { 'folder': 'footprints', 'min': 4, 'max': 64, 'step': 1 }, // extent of the ground plane
  'depth': { 'folder': 'footprints', 'min': 0, 'max': 16, 'step': 1 }, // cell count is bounded by 2^depth
  'minSide': { 'folder': 'footprints', 'min': 0.05, 'max': 2, 'step': 0.01 }, // no cut may leave a side shorter
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
} as const;

export type ParamKey = keyof typeof SCHEMA;
export type Params = Record<ParamKey, number>;

// Changing anything in the footprints or heights folder invalidates data that is computed once per rebuild;
// the motion folder (except spread, which feeds the precomputed delays) is read every frame.
export const LIVE_KEYS: ParamKey[] = ['loopPeriod', 'rise', 'fall', 'overshoot'];

export const loadParams = (): Params => {
  const values = saved as Record<string, unknown>;
  const missing = (Object.keys(SCHEMA) as ParamKey[]).filter((key) => typeof values[key] !== 'number');
  // Loud and early: a missing key would otherwise reach the geometry as NaN and render nothing at all.
  if (missing.length > 0) throw new Error(`params.json is missing or non-numeric: ${missing.join(', ')}`);
  return { ...(values as Params) };
};
