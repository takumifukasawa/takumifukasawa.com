// The *schema* of the knobs lives here. The *values* live in params.json, which the save button in the
// debug pane writes. Nothing in this file is a value, so tuning never produces a code diff.
// (Same shape as lab/grid-ray-clock/params.ts. Every knob is read live except the ones that size the floor (gridY, floorCells, floorMargin, camPitch, camLift, camYaw, the swings, camFov), which are read at load.)
import saved from './params.json' with { type: 'json' };

export type Spec = {
  folder: string;
  min?: number;
  max?: number;
  step?: number;
  view?: 'color';
  options?: Record<string, number>;
};

export const SCHEMA = {
  // world.ts and main.ts -- the box is gridY cells high. Its floor is sized at load to cover this screen as
  // seen from the camera, so how many cells it has across and deep depends on the screen and the camera angle.
  gridY: { folder: 'world', min: 2, max: 64, step: 1 },
  floorCells: { folder: 'world', min: 500, max: 80000, step: 500 }, // the floor's cells, on any screen: the voxels' size follows from it
  minCellPx: { folder: 'world', min: 1, max: 40, step: 0.5 }, // smallest a cell at the screen's centre may be, in CSS pixels: keeps voxels big on a phone
  floorMargin: { folder: 'world', min: 1, max: 2, step: 0.01 }, // floor beyond what the screen needs, so a slightly bigger window still lands on floor
  // rain.ts
  rainRate: { folder: 'rain', min: 0, max: 80, step: 0.5 }, // drops per second, over the whole screen
  dropSpeed: { folder: 'rain', min: 1, max: 120, step: 0.5 }, // cells per second
  trailLife: { folder: 'rain', min: 0.01, max: 1, step: 0.005 }, // seconds a lit cell takes to fade to 1/e
  trailSpread: { folder: 'rain', min: 0, max: 0.95, step: 0.01 }, // each drop's trail is trailLife times 1 +- this, at random
  impulse: { folder: 'rain', min: 0, max: 5, step: 0.01 }, // how hard a drop pushes the floor
  impulseSpread: { folder: 'rain', min: 0, max: 1, step: 0.01 }, // 0 = every drop the same, 1 = anywhere from 0 to impulse
  tapImpulse: { folder: 'rain', min: 0, max: 20, step: 0.1 }, // a click or tap drops one this hard
  dragImpulse: { folder: 'rain', min: 0, max: 20, step: 0.1 }, // dragging drops these along the path
  dragSpacing: { folder: 'rain', min: 0.5, max: 32, step: 0.5 }, // cells of floor between them
  pointerHeight: { folder: 'rain', min: 1, max: 64, step: 0.5 }, // height of the level plane the pointer is cast onto: click / drag drops start there, under the pointer
  // world.ts -- the floor's wave
  waveSpeed: { folder: 'wave', min: 0.01, max: 0.5, step: 0.005 }, // c^2, cells^2 per step; unstable above 0.5
  waveSteps: { folder: 'wave', min: 0, max: 8, step: 1 }, // per fixed step (60 Hz)
  waveDamping: { folder: 'wave', min: 0.9, max: 1, step: 0.0005 }, // per step
  waveEdge: { folder: 'wave', min: 0, max: 16, step: 0.5 }, // cells of absorbing border, so rings leave instead of reflecting
  rippleGain: { folder: 'wave', min: 0, max: 20, step: 0.05 }, // brightness per unit of wave height
  rippleMax: { folder: 'wave', min: 0, max: 10, step: 0.05 }, // brightness cap, so the impact itself does not white out
  rippleSizeMin: { folder: 'wave', min: 0.1, max: 1.5, step: 0.01 }, // a floor cell's size as it fades out, against a full cell
  rippleSizeMax: { folder: 'wave', min: 0.1, max: 1.5, step: 0.01 }, // and where the wave is strongest
  rippleHeight: { folder: 'wave', min: 0, max: 20, step: 0.1 }, // how far a floor cell rises and sinks with the wave, cells per unit of wave
  rippleEmission: { folder: 'wave', min: 0, max: 6, step: 0.05 }, // brightness of the ripple cells alone; does not change which are drawn
  // sparks.ts -- where a click / drag drop appears
  sparkCount: { folder: 'sparks', min: 0, max: 64, step: 1 }, // per drop; 0 = none
  sparkSpeed: { folder: 'sparks', min: 0, max: 40, step: 0.5 }, // cells per second at the start
  sparkLife: { folder: 'sparks', min: 0.05, max: 3, step: 0.05 }, // seconds
  sparkSize: { folder: 'sparks', min: 0.02, max: 1, step: 0.01 }, // cells
  sparkGain: { folder: 'sparks', min: 0, max: 6, step: 0.05 }, // above bloomThreshold = blooms
  // look
  rainBrightness: { folder: 'look', min: 0, max: 10, step: 0.05 }, // above bloomThreshold = blooms
  minGlow: { folder: 'look', min: 0, max: 2, step: 0.01 }, // dimmer than this, a cell is not drawn
  fadeRange: { folder: 'look', min: 0, max: 4, step: 0.01 }, // brightness above minGlow over which a cell fades in from black, so it does not pop out
  gap: { folder: 'look', min: 0, max: 0.5, step: 0.005 }, // between neighbouring voxels, cells
  shade: { folder: 'look', min: 0, max: 1, step: 0.01 }, // 0 = flat, 1 = faces fully lit / unlit
  edgeWidth: { folder: 'look', min: 0, max: 0.25, step: 0.005 }, // the voxels' edges, cells; 0 = none
  edgeGain: { folder: 'look', min: 0, max: 6, step: 0.05 }, // edge brightness against the voxel's own
  latticeSize: { folder: 'look', min: 0, max: 0.3, step: 0.005 }, // the grid points, cells; 0 = none
  latticeStep: { folder: 'look', min: 0, max: 64, step: 1 }, // grid points on every this many layers from the floor; read at load
  exposure: { folder: 'look', min: 0.1, max: 4, step: 0.05 },
  // camera (main.ts). Its distance follows from floorCells; the floor reaches past every edge of the screen.
  // The top of the screen has to look down onto the floor: camPitch must stay above half of camFov.
  camFov: { folder: 'camera', min: 10, max: 80, step: 1 },
  // Fog, in multiples of the camera's distance to the floor's centre. Past fogFar there is only background, so the
  // floor is built no further out than that (read at load).
  fogNear: { folder: 'camera', min: 0, max: 6, step: 0.05 },
  fogFar: { folder: 'camera', min: 0.5, max: 8, step: 0.05 },
  camPitch: { folder: 'camera', min: -89, max: 89, step: 0.5 }, // degrees down onto the target; negative looks up at it
  camView: { folder: 'camera', options: { above: 0, below: 1 } }, // which of the two pitches to use; switching rebuilds the floor
  camPitchBelow: { folder: 'camera', min: -89, max: 89, step: 0.5 }, // camPitch when camView is below
  camLift: { folder: 'camera', min: 0, max: 2, step: 0.01 }, // the target's height above the floor, in camera distances (read at load)
  camYaw: { folder: 'camera', min: -180, max: 180, step: 1 }, // degrees
  // The camera sways back and forth by these many degrees, so the floor sized at load still covers the screen.
  camPitchSwing: { folder: 'camera', min: 0, max: 15, step: 0.1 },
  camPitchPeriod: { folder: 'camera', min: 4, max: 180, step: 1 }, // seconds
  camYawSwing: { folder: 'camera', min: 0, max: 30, step: 0.1 },
  camYawPeriod: { folder: 'camera', min: 4, max: 180, step: 1 }, // seconds
  // colour
  bgColor: { folder: 'colour', view: 'color' },
  rainColor: { folder: 'colour', view: 'color' },
  rippleColor: { folder: 'colour', view: 'color' },
  latticeColor: { folder: 'colour', view: 'color' },
  edgeColor: { folder: 'colour', view: 'color' },
  sparkColor: { folder: 'colour', view: 'color' },
  // post.ts
  bloomStrength: { folder: 'post', min: 0, max: 3, step: 0.01 },
  bloomRadius: { folder: 'post', min: 0, max: 1, step: 0.01 },
  bloomThreshold: { folder: 'post', min: 0, max: 4, step: 0.01 },
  bloomKnee: { folder: 'post', min: 0.01, max: 1, step: 0.01 },
  // Bloom resolution relative to the frame. The bloom is pure fill rate, so this is the main lever on its
  // cost. Too low and thin drops flicker in the bright pass (see post.ts).
  bloomScale: { folder: 'post', min: 0.1, max: 1, step: 0.05 },
  chromaticAberration: { folder: 'post', min: 0, max: 0.05, step: 0.0005 }, // red / blue shift at the corners, as a share of the distance from the centre
  msaa: { folder: 'post', min: 0, max: 4, step: 2 },
  // quality.ts -- dynamic resolution
  autoQuality: { folder: 'perf', min: 0, max: 1, step: 1 },
  qualityMs: { folder: 'perf', min: 14, max: 60, step: 1 },
  pixelRatio: { folder: 'perf', min: 0.5, max: 2, step: 0.1 },
  // ?capture only (capture.ts)
  captureWidth: { folder: 'capture', min: 320, max: 3840, step: 2 },
  captureHeight: { folder: 'capture', min: 320, max: 3840, step: 2 },
  captureScale: { folder: 'capture', min: 1, max: 4, step: 0.5 },
  captureMsaa: { folder: 'capture', min: 0, max: 8, step: 2 },
  captureBloomScale: { folder: 'capture', min: 0.25, max: 2, step: 0.25 },
} as const satisfies Record<string, Spec>;

export type ParamKey = keyof typeof SCHEMA;
export type Params = Record<ParamKey, number>;

export const isColor = (key: ParamKey) => (SCHEMA[key] as Spec).view === 'color';

// A colour is a number in memory and "#rrggbb" in params.json.
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
  if (missing.length > 0) throw new Error(`params.json is missing or unreadable: ${missing.join(', ')}`);
  return params;
};
