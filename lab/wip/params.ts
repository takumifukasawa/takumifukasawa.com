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
  // How big one panel reads. Leaves stay under maxSide so they sit on the curve; a plate is the ancestor
  // they share a height with, so this is what brings back the range of sizes that maxSide alone destroys.
  'plateSize': { 'folder': 'footprints', 'min': 0.3, 'max': 12, 'step': 0.1 },
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
  'autoGrow': { 'folder': 'motion', 'min': 0, 'max': 1, 'step': 0.01 }, // 0 = the field just stands there
  'loopPeriod': { 'folder': 'motion', 'min': 2, 'max': 30, 'step': 0.5 }, // seconds for one rise/hold/fall cycle
  'spread': { 'folder': 'motion', 'min': 0, 'max': 1, 'step': 0.01 }, // phase spread across the field
  'rise': { 'folder': 'motion', 'min': 0.02, 'max': 0.6, 'step': 0.01 }, // fraction of the period spent rising
  'fall': { 'folder': 'motion', 'min': 0.02, 'max': 0.6, 'step': 0.01 }, // fraction spent sinking back
  'overshoot': { 'folder': 'motion', 'min': 0, 'max': 3, 'step': 0.05 }, // how far the rise goes past full height
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
  // pointer (lift.ts) -- the interaction
  'liftRadius': { 'folder': 'pointer', 'min': 0.2, 'max': 12, 'step': 0.1 }, // world units of influence
  'liftHeight': { 'folder': 'pointer', 'min': 0, 'max': 12, 'step': 0.1 }, // added at the centre, domain units
  'liftRise': { 'folder': 'pointer', 'min': 0.5, 'max': 30, 'step': 0.5 }, // per second; higher = snappier
  'liftFall': { 'folder': 'pointer', 'min': 0.2, 'max': 20, 'step': 0.1 }, // per second; lower = settles slowly
  // flow (flow.ts) -- the streaks crossing the field
  'flowCount': { 'folder': 'flow', 'min': 0, 'max': 6000, 'step': 50 }, // rebuilds the instanced mesh
  'flowSpeed': { 'folder': 'flow', 'min': 0.5, 'max': 30, 'step': 0.5 }, // world units per second
  // Degrees in the ground plane. 0 is what reads as upper-left to lower-right ON SCREEN at the default
  // camera azimuth. A world direction and a screen direction are not the same thing: setting this to the
  // camera's own 45 sends the stream straight at the viewer, and the sign is easy to derive backwards
  // (it was, twice). If the camera framing changes, re-check this by looking rather than by deriving.
  'flowAngle': { 'folder': 'flow', 'min': 0, 'max': 360, 'step': 1 },
  'flowPush': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.1 }, // away from rising ground
  'flowSwirl': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.1 }, // along its contour -- this is "around"
  'flowTurn': { 'folder': 'flow', 'min': 0.5, 'max': 30, 'step': 0.5 }, // how fast a streak can change heading
  'flowTrail': { 'folder': 'flow', 'min': 1, 'max': 32, 'step': 1 }, // spine segments; rebuilds the geometry
  'flowWidth': { 'folder': 'flow', 'min': 0.01, 'max': 1.5, 'step': 0.01 }, // ribbon width at the head
  'flowHead': { 'folder': 'flow', 'min': 0, 'max': 2, 'step': 0.01 }, // the camera-facing disc at the tip
  'flowBrightness': { 'folder': 'flow', 'min': 0, 'max': 4, 'step': 0.05 },
  'flowAltitude': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.05 }, // above the fixed greeble, below the raised
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
  'autoGrow', 'loopPeriod', 'rise', 'fall', 'overshoot',
  'exposure', 'camSwing',
  'keyLight', 'rimLight', 'ambient', 'fogNear', 'fogFar',
  'liftRadius', 'liftHeight', 'liftRise', 'liftFall',
  'flowSpeed', 'flowAngle', 'flowPush', 'flowSwirl', 'flowTurn', 'flowWidth', 'flowHead', 'flowBrightness', 'flowAltitude',
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
