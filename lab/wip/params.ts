// The *schema* of the knobs lives here. The *values* live in params.json, which the save button in the debug pane
// writes (debug.ts). Nothing in this file is a value, so tuning never produces a code diff.
// (Same shape as lab/voxel-rain/params.ts, without colours.) Every knob is read live.
import saved from './params.json' with { type: 'json' };
import { Color } from 'three/webgpu';
import { uniform } from 'three/tsl';

// A colour (`view: 'color'`) is a number 0xRRGGBB in memory and "#rrggbb" in params.json (as lab/voxel-rain/params.ts).
export type Spec = { folder: string; min?: number; max?: number; step?: number; view?: 'color' };

export const SCHEMA = {
  // step.wgsl
  k: { folder: 'wave', min: 0.01, max: 0.16, step: 0.001 }, // how strongly neighbors pull; unstable above 1/6
  damping: { folder: 'wave', min: 0.9, max: 1, step: 0.0005 }, // per step
  anchor: { folder: 'wave', min: 0, max: 0.2, step: 0.001 }, // pull back to rest, per step
  knockRadius: { folder: 'wave', min: 0.5, max: 10, step: 0.1 }, // cells
  knockStrength: { folder: 'wave', min: 0, max: 2, step: 0.01 }, // velocity added at the knock's center
  stepsPerFrame: { folder: 'wave', min: 0, max: 8, step: 1 }, // per fixed step (60 Hz); main.ts
  // offset.wgsl
  offsetScale: { folder: 'look', min: 0, max: 40, step: 0.1 },
  offsetCurve: { folder: 'look', min: 0.1, max: 1, step: 0.01 }, // 1 = as is; smaller lifts small waves
  // voxels.ts: the box's rounded edges. Geometry, so changing them rebuilds the box (not a uniform)
  bevelRadius: { folder: 'look', min: 0, max: 0.45, step: 0.005 }, // the box is 0.9 wide
  bevelSegments: { folder: 'look', min: 1, max: 6, step: 1 },
  // voxels.ts: the material (MeshStandardNodeMaterial)
  roughness: { folder: 'look', min: 0, max: 1, step: 0.01 },
  metalness: { folder: 'look', min: 0, max: 1, step: 0.01 }, // no environment map, so metal goes dark
  // color.wgsl
  colorRange: { folder: 'look', min: 0.001, max: 0.5, step: 0.001 }, // |disp| at full color
  glow: { folder: 'look', min: 1, max: 10, step: 0.1 }, // the wave's colors times this; above 1 they bloom
  // colour. rest / sink / rise: color.wgsl. bg / ambient / sun: main.ts
  restColor: { folder: 'colour', view: 'color' }, // at rest
  sinkColor: { folder: 'colour', view: 'color' }, // disp > 0, toward the center
  riseColor: { folder: 'colour', view: 'color' }, // disp < 0, outward
  sinkIntensity: { folder: 'colour', min: 0, max: 20, step: 0.01 }, // times glow: a picked color is at most 1
  riseIntensity: { folder: 'colour', min: 0, max: 20, step: 0.01 },
  bgColor: { folder: 'colour', view: 'color' },
  // light: main.ts
  ambientColor: { folder: 'light', view: 'color' },
  ambientIntensity: { folder: 'light', min: 0, max: 3, step: 0.01 },
  sunColor: { folder: 'light', view: 'color' },
  sunIntensity: { folder: 'light', min: 0, max: 10, step: 0.01 },
  sunX: { folder: 'light', min: -1, max: 1, step: 0.01 }, // where the sun is; it points at the origin
  sunY: { folder: 'light', min: -1, max: 1, step: 0.01 },
  sunZ: { folder: 'light', min: -1, max: 1, step: 0.01 },
  // post.ts
  bloomStrength: { folder: 'post', min: 0, max: 3, step: 0.01 },
  bloomRadius: { folder: 'post', min: 0, max: 1, step: 0.01 },
  bloomThreshold: { folder: 'post', min: 0, max: 2, step: 0.01 }, // luminance that starts to glow
  aberration: { folder: 'post', min: 0, max: 3, step: 0.01 }, // 0 = none; grows toward the frame's edges
} as const satisfies Record<string, Spec>;

export type ParamKey = keyof typeof SCHEMA;
export type Params = Record<ParamKey, number>;

const KEYS = Object.keys(SCHEMA) as ParamKey[];

type ColorKey = { [K in ParamKey]: (typeof SCHEMA)[K] extends { view: 'color' } ? K : never }[ParamKey];
type NumberKey = Exclude<ParamKey, ColorKey>;

export const isColor = (key: ParamKey): key is ColorKey => (SCHEMA[key] as Spec).view === 'color';

// What the save button writes to params.json.
export const toJSON = (params: Params): Record<string, number | string> => {
  const out: Record<string, number | string> = {};
  for (const key of KEYS) out[key] = isColor(key) ? '#' + params[key].toString(16).padStart(6, '0') : params[key];
  return out;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export const loadParams = (): Params => {
  const values = saved as Record<string, unknown>;
  const params = {} as Params;
  const missing: string[] = [];
  for (const key of KEYS) {
    const raw = values[key];
    if (typeof raw === 'number') params[key] = raw;
    else if (isColor(key) && typeof raw === 'string' && HEX.test(raw)) params[key] = parseInt(raw.slice(1), 16);
    else missing.push(key);
  }
  if (missing.length > 0) throw new Error(`params.json is missing or unreadable: ${missing.join(', ')}`);
  return params;
};

// One uniform per knob, for the .wgsl inputs of the same name. `sync` copies the pane's edits in; call it before
// the frame's computes and render. A colour's uniform is a Color: setHex reads the hex as sRGB and stores it
// linear, the space the shaders work in.
const makeUniform = (value: number) => uniform(value);
const makeColor = (hex: number) => uniform(new Color(hex));
export type Uniforms = Record<NumberKey, ReturnType<typeof makeUniform>> &
  Record<ColorKey, ReturnType<typeof makeColor>> & { sync: () => void };

export const createUniforms = (params: Params): Uniforms => {
  const nodes = Object.fromEntries(KEYS.map((key) => [key, isColor(key) ? makeColor(params[key]) : makeUniform(params[key])])) as Omit<
    Uniforms,
    'sync'
  >;
  return {
    ...nodes,
    sync: () => {
      for (const key of KEYS) {
        if (isColor(key)) nodes[key].value.setHex(params[key]);
        else nodes[key].value = params[key];
      }
    },
  };
};
