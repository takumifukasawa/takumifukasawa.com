// The *schema* of the knobs lives here. The *values* live in params.json, which the save button in the
// debug pane writes. Nothing in this file is a value, so tuning the sketch never produces a code diff --
// and the committed build and every recording read the same file the pane wrote.
//
// Quoted keys throughout: terser mangles unquoted property names in the build, and these are read by
// string (Tweakpane bindings, JSON keys). See the note in vite.config.ts.
// The import attribute is required by Node and accepted by Vite, so params.ts can also be imported from a
// plain `node script.ts` -- which is how the loop is verified numerically (the browser cannot be trusted to
// animate at all in an automated tab; docs/learnings.md 2026-10-12).
import saved from './params.json' with { type: 'json' };

// One knob's declaration. A colour is `view: 'color'` and still a NUMBER (0xRRGGBB) -- Tweakpane binds a
// number as a colour picker, so the whole palette becomes tunable without Params turning into
// Record<string, number | string> and taking every arithmetic site in the sketch with it.
export type Spec = { 'folder': string; 'min'?: number; 'max'?: number; 'step'?: number; 'view'?: 'color' };

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
  'camSwing': { 'folder': 'look', 'min': 0, 'max': 1.2, 'step': 0.01 }, // radians the camera swings either way
  'camPeriod': { 'folder': 'look', 'min': 4, 'max': 180, 'step': 1 }, // seconds for one swing, there and back
  // The framing. Distance and height are multiples of size; the composition is scale-invariant, so
  // these ratios and camFov are the only things that decide whether the floor covers the frame.
  'camDistance': { 'folder': 'look', 'min': 0.2, 'max': 3, 'step': 0.01 },
  'camHeight': { 'folder': 'look', 'min': 0.05, 'max': 2, 'step': 0.01 },
  'camFov': { 'folder': 'look', 'min': 10, 'max': 80, 'step': 1 },
  // Lighting and fog, as multiples of `size` where they are distances, so they survive a change of scale.
  // All live: the look is tuned by eye from the pane, and a rebuild per slider drag makes that unusable.
  'keyLight': { 'folder': 'light', 'min': 0, 'max': 12, 'step': 0.1 },
  'rimLight': { 'folder': 'light', 'min': 0, 'max': 12, 'step': 0.1 },
  'ambient': { 'folder': 'light', 'min': 0, 'max': 4, 'step': 0.05 }, // hemisphere + environment together
  // How dark the key light's shadow goes. 1 is a full shadow, 0 removes it entirely. This is three's own
  // shadow.intensity, which lifts the shadow without touching the fill lights -- raising `ambient` to the
  // same effect would also flatten every unlit face, which is the opposite of what a shallower shadow is for.
  'shadowStrength': { 'folder': 'light', 'min': 0, 'max': 1, 'step': 0.01 },
  // Shadow map resolution, as a power of two (9 = 512 ... 12 = 4096). Rebuilds the map, so it is not live.
  // It costs much less than it looks like it should: the map is only redrawn on frames where the field
  // actually moves (see main.ts), so a still field pays for it once.
  'shadowBits': { 'folder': 'light', 'min': 9, 'max': 12, 'step': 1 },
  'fogNear': { 'folder': 'light', 'min': 0.1, 'max': 6, 'step': 0.05 },
  'fogFar': { 'folder': 'light', 'min': 0.5, 'max': 12, 'step': 0.1 },
  // pointer (lift.ts) -- the interaction
  'liftRadius': { 'folder': 'pointer', 'min': 0.2, 'max': 12, 'step': 0.1 }, // world units of influence
  'liftHeight': { 'folder': 'pointer', 'min': 0, 'max': 12, 'step': 0.1 }, // added at the centre, domain units
  'liftRise': { 'folder': 'pointer', 'min': 0.5, 'max': 30, 'step': 0.5 }, // per second; higher = snappier
  'liftFall': { 'folder': 'pointer', 'min': 0.2, 'max': 20, 'step': 0.1 }, // per second; lower = settles slowly
  // flow (flow.ts) -- the streaks crossing the field
  'flowCount': { 'folder': 'flow', 'min': 0, 'max': 20000, 'step': 100 }, // rebuilds the instanced mesh
  'flowSpeed': { 'folder': 'flow', 'min': 0.5, 'max': 30, 'step': 0.5 }, // world units per second
  // Degrees in the ground plane. 0 is what reads as upper-left to lower-right ON SCREEN at the default
  // camera azimuth. A world direction and a screen direction are not the same thing: setting this to the
  // camera's own 45 sends the stream straight at the viewer, and the sign is easy to derive backwards
  // (it was, twice). If the camera framing changes, re-check this by looking rather than by deriving.
  'flowAngle': { 'folder': 'flow', 'min': 0, 'max': 360, 'step': 1 },
  'flowPush': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.1 }, // away from rising ground
  'flowSwirl': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.1 }, // along its contour -- this is "around"
  // Particles steering away from each other (flow.ts), so converging streams stay side by side.
  'flowJitter': { 'folder': 'flow', 'min': 0, 'max': 1, 'step': 0.01 }, // per-particle spread of push and swirl
  'flowSeparate': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.05 }, // 0 turns it off (and its cost)
  'flowSeparateRadius': { 'folder': 'flow', 'min': 0.05, 'max': 3, 'step': 0.01 }, // world units
  'flowTurn': { 'folder': 'flow', 'min': 0.5, 'max': 30, 'step': 0.5 }, // how fast a streak can change heading
  'flowTrail': { 'folder': 'flow', 'min': 1, 'max': 32, 'step': 1 }, // spine segments; rebuilds the geometry
  'flowWidth': { 'folder': 'flow', 'min': 0.01, 'max': 1.5, 'step': 0.01 }, // ribbon width at the head
  // The camera-facing disc at the tip, as a MULTIPLE of flowWidth. 0 removes it; about 1.8 puts its bright
  // core flush with the ribbon; above that it reads as a glow around the head. Relative rather than
  // absolute so that narrowing the ribbon narrows the cap with it instead of leaving it mismatched.
  'flowHead': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.05 },
  'flowBrightness': { 'folder': 'flow', 'min': 0, 'max': 4, 'step': 0.05 },
  // Extra brightness while a streak is bending (flow.ts glow): at full glow it is flowBrightness x (1 + this).
  // Above the bloom threshold, so the bend is what blooms. 0 turns it off.
  'flowGlow': { 'folder': 'flow', 'min': 0, 'max': 10, 'step': 0.05 },
  'flowGlowTurn': { 'folder': 'flow', 'min': 0.1, 'max': 10, 'step': 0.05 }, // rad/s of turning that counts as full glow
  'flowGlowDecay': { 'folder': 'flow', 'min': 0.02, 'max': 3, 'step': 0.01 }, // seconds the flare takes to fade after the bend
  // Half-width of the region the stream lives in, as a fraction of size. Keep it just past the edge of the
  // frame: everything outside is simulated and uploaded every frame for nothing (flow.ts BOUND).
  'flowExtent': { 'folder': 'flow', 'min': 0.1, 'max': 1, 'step': 0.01 },
  'flowAltitude': { 'folder': 'flow', 'min': 0, 'max': 8, 'step': 0.05 }, // above the fixed greeble, below the raised
  // post (post.ts)
  'bloomStrength': { 'folder': 'post', 'min': 0, 'max': 3, 'step': 0.01 },
  'bloomRadius': { 'folder': 'post', 'min': 0, 'max': 2, 'step': 0.01 },
  // Bloom resolution; rebuilds targets. Below 1 the bright pass samples the frame sparsely, so a thin light
  // is caught on one frame and missed on the next -- the flicker gets worse, not just softer.
  'bloomScale': { 'folder': 'post', 'min': 0.1, 'max': 1, 'step': 0.05 },
  // MSAA samples on the composer's target (post.ts). 0 / 2 / 4; steadies thin lights going into bloom.
  'msaa': { 'folder': 'post', 'min': 0, 'max': 4, 'step': 2 },
  'bloomThreshold': { 'folder': 'post', 'min': 0, 'max': 2, 'step': 0.01 },
  // How softly brightness enters the bloom. three hardcodes this at 0.01, which is a step, and a step is
  // what makes bloom flicker on a moving camera. Widen it until the shimmer stops.
  'bloomKnee': { 'folder': 'post', 'min': 0.01, 'max': 1, 'step': 0.01 },
  'aberration': { 'folder': 'post', 'min': 0, 'max': 0.2, 'step': 0.002 }, // UV offset at the corners, so tiny
  // Depth of field. 0 aperture disables the pass entirely -- it costs a second geometry pass (see post.ts).
  'dofAperture': { 'folder': 'post', 'min': 0, 'max': 3, 'step': 0.05 },
  'dofFocus': { 'folder': 'post', 'min': 0.2, 'max': 4, 'step': 0.02 }, // focal distance, as a multiple of size
  'dofMaxBlur': { 'folder': 'post', 'min': 0, 'max': 0.03, 'step': 0.001 },
  // Surfaces. Separate from the colours because roughness and metalness are what decide whether the
  // environment map is visible at all: at metalness 0 a standard material ignores it entirely.
  'edgeWidth': { 'folder': 'material', 'min': 0, 'max': 0.1, 'step': 0.001 }, // world units; boxes are >= minSide
  'edgeStrength': { 'folder': 'material', 'min': 0, 'max': 4, 'step': 0.01 },
  'massRough': { 'folder': 'material', 'min': 0, 'max': 1, 'step': 0.01 },
  'massMetal': { 'folder': 'material', 'min': 0, 'max': 1, 'step': 0.01 },
  'barRough': { 'folder': 'material', 'min': 0, 'max': 1, 'step': 0.01 },
  'barMetal': { 'folder': 'material', 'min': 0, 'max': 1, 'step': 0.01 },
  'groundRough': { 'folder': 'material', 'min': 0, 'max': 1, 'step': 0.01 },
  'groundMetal': { 'folder': 'material', 'min': 0, 'max': 1, 'step': 0.01 },
  // How strongly the HDRI shows up, independent of the hemisphere fill. These used to be one knob
  // (environmentIntensity = ambient * 0.6), so the reflections could not be dialled in without also
  // moving the flat fill -- and with a real HDRI the reflection IS the look.
  'envIntensity': { 'folder': 'material', 'min': 0, 'max': 4, 'step': 0.05 },
  // The palette. Every colour in the sketch is here; none is written in a .ts file.
  'bgColor': { 'folder': 'colour', 'view': 'color' }, // background AND fog -- they must match or a horizon appears
  'massColor': { 'folder': 'colour', 'view': 'color' },
  'edgeColor': { 'folder': 'colour', 'view': 'color' }, // box edges (edges.ts / edge.glsl)
  'barColor': { 'folder': 'colour', 'view': 'color' }, // the bars' base colour, underneath the emission
  'barEmissive': { 'folder': 'colour', 'view': 'color' },
  'groundColor': { 'folder': 'colour', 'view': 'color' },
  'flowColor': { 'folder': 'colour', 'view': 'color' },
  'keyColor': { 'folder': 'colour', 'view': 'color' },
  'rimColor': { 'folder': 'colour', 'view': 'color' },
  'skyColor': { 'folder': 'colour', 'view': 'color' }, // hemisphere, from above
  'earthColor': { 'folder': 'colour', 'view': 'color' }, // hemisphere, bounced from below
  // Dynamic resolution (quality.ts). 1 = let the sketch give up resolution when frames run long.
  // Tier 0 is exactly what params.json says, so this can only ever take quality away, never add it.
  'autoQuality': { 'folder': 'perf', 'min': 0, 'max': 1, 'step': 1 },
  // Frame time in ms above which it steps down. 24 is about 42 fps; below that the motion stops reading
  // as motion. The step back up is at 72% of this, and the gap between the two is what stops it flapping.
  'qualityMs': { 'folder': 'perf', 'min': 14, 'max': 60, 'step': 1 },
  // The biggest lever on a phone. Post is fill-rate bound (the DOF blur alone is 41 taps per pixel), and a
  // modern phone reports devicePixelRatio 3, so the cap here decides how many pixels all of that runs over.
  // Capped against the device's own ratio, never multiplied past it.
  'pixelRatio': { 'folder': 'perf', 'min': 0.5, 'max': 2, 'step': 0.1 }
} as const satisfies Record<string, Spec>;

export type ParamKey = keyof typeof SCHEMA;
export type Params = Record<ParamKey, number>;

// Knobs the render loop reads every frame. Everything NOT listed here feeds data that is computed once per
// rebuild (footprints, heights, per-cell delays, materials), so changing it has to rebuild the field.
// `spread` looks like motion but feeds the precomputed delays, so it is deliberately absent.
export const LIVE_KEYS: ParamKey[] = [
  'autoGrow', 'loopPeriod', 'rise', 'fall', 'overshoot',
  'exposure', 'camSwing', 'camPeriod', 'camDistance', 'camHeight', 'camFov',
  'keyLight', 'rimLight', 'ambient', 'shadowStrength', 'fogNear', 'fogFar',
  'liftRadius', 'liftHeight', 'liftRise', 'liftFall',
  'flowSpeed', 'flowAngle', 'flowPush', 'flowSwirl', 'flowJitter', 'flowSeparate', 'flowSeparateRadius', 'flowTurn', 'flowWidth', 'flowHead', 'flowBrightness', 'flowGlow', 'flowGlowTurn', 'flowGlowDecay', 'flowAltitude', 'flowExtent',
  'bloomStrength', 'bloomRadius', 'bloomThreshold', 'bloomScale', 'bloomKnee', 'msaa', 'aberration',
  'dofAperture', 'dofFocus', 'dofMaxBlur', 'pixelRatio', 'autoQuality', 'qualityMs',
  // Materials and colours are assigned onto the existing objects every frame, so none of them rebuilds
  // the field. `emissive` used to: it was read once when the material was made, which meant the one knob
  // the bloom threshold has to be balanced against was the one that cost a full rebuild to try.
  'emissive', 'edgeWidth', 'edgeStrength', 'edgeColor', 'massRough', 'massMetal', 'barRough', 'barMetal', 'groundRough', 'groundMetal', 'envIntensity',
  'bgColor', 'massColor', 'barColor', 'barEmissive', 'groundColor', 'flowColor',
  'keyColor', 'rimColor', 'skyColor', 'earthColor',
];

export const isColor = (key: ParamKey) => (SCHEMA[key] as Spec)['view'] === 'color';

// A colour is a number in memory and "#rrggbb" in params.json. The file is the one place a human reads
// these values back, and 7042176 is not a colour anybody can read.
export const toJSON = (params: Params): Record<string, number | string> => {
  const out: Record<string, number | string> = {};
  for (const key of Object.keys(SCHEMA) as ParamKey[]) {
    out[key] = isColor(key) ? '#' + params[key].toString(16).padStart(6, '0') : params[key];
  }
  return out;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export const loadParams = (): Params => {
  const values = saved as Record<string, unknown>;
  const params = {} as Params;
  const missing: string[] = [];
  for (const key of Object.keys(SCHEMA) as ParamKey[]) {
    const raw = values[key];
    if (typeof raw === 'number') {
      params[key] = raw;
    } else if (isColor(key) && typeof raw === 'string' && HEX.test(raw)) {
      params[key] = parseInt(raw.slice(1), 16);
    } else {
      missing.push(key);
    }
  }
  // Loud and early: a missing key would otherwise reach the geometry as NaN and render nothing at all.
  if (missing.length > 0) throw new Error(`params.json is missing or unreadable: ${missing.join(', ')}`);
  return params;
};
