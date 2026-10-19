// The *schema* of the knobs lives here. The *values* live in params.json, which the save button in the debug pane
// writes (debug.ts). Nothing in this file is a value, so tuning never produces a code diff.
// (Same shape as lab/voxel-rain/params.ts, without colours.) Every knob is read live.
import saved from './params.json' with { type: 'json' };
import { uniform } from 'three/tsl';

export type Spec = { folder: string; min: number; max: number; step: number };

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
  // color.wgsl
  colorRange: { folder: 'look', min: 0.001, max: 0.5, step: 0.001 }, // |disp| at full color
  glow: { folder: 'look', min: 1, max: 10, step: 0.1 }, // the wave's colors times this; above 1 they bloom
  // post.ts
  bloomStrength: { folder: 'post', min: 0, max: 3, step: 0.01 },
  bloomRadius: { folder: 'post', min: 0, max: 1, step: 0.01 },
  bloomThreshold: { folder: 'post', min: 0, max: 2, step: 0.01 }, // luminance that starts to glow
  aberration: { folder: 'post', min: 0, max: 3, step: 0.01 }, // 0 = none; grows toward the frame's edges
} as const satisfies Record<string, Spec>;

export type ParamKey = keyof typeof SCHEMA;
export type Params = Record<ParamKey, number>;

const KEYS = Object.keys(SCHEMA) as ParamKey[];

export const loadParams = (): Params => {
  const values = saved as Record<string, unknown>;
  const params = {} as Params;
  const missing: string[] = [];
  for (const key of KEYS) {
    const raw = values[key];
    if (typeof raw === 'number') params[key] = raw;
    else missing.push(key);
  }
  if (missing.length > 0) throw new Error(`params.json is missing or unreadable: ${missing.join(', ')}`);
  return params;
};

// One uniform per knob, for the .wgsl inputs of the same name. `sync` copies the pane's edits in; call it before
// the frame's computes and render.
const makeUniform = (value: number) => uniform(value);
export type Uniforms = Record<ParamKey, ReturnType<typeof makeUniform>> & { sync: () => void };

export const createUniforms = (params: Params): Uniforms => {
  const nodes = Object.fromEntries(KEYS.map((key) => [key, makeUniform(params[key])])) as Record<ParamKey, ReturnType<typeof makeUniform>>;
  return {
    ...nodes,
    sync: () => {
      for (const key of KEYS) nodes[key].value = params[key];
    },
  };
};
