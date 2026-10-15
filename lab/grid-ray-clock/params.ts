// The *schema* of the knobs lives here. The *values* live in params.json, which the save button in the
// debug pane writes. Nothing in this file is a value, so tuning never produces a code diff.
// (Same shape as lab/greeble-flow/params.ts. Every knob is read live: there is nothing to rebuild, because
// a route knob only affects batches built after it changes -- the next second.)
import saved from './params.json' with { type: 'json' };

export type Spec = {
  'folder': string;
  'min'?: number;
  'max'?: number;
  'step'?: number;
  'view'?: 'color';
  'options'?: Record<string, number>;
};

export const SCHEMA = {
  // clock.ts
  'layout': { 'folder': 'clock', 'options': { 'auto': 0, 'row': 1, 'column': 2 } }, // auto = row if landscape
  // lines.ts -- timing, in seconds. A line leaves `travel` before the second and lands on it.
  'travel': { 'folder': 'motion', 'min': 0.1, 'max': 3, 'step': 0.05 },
  'ease': { 'folder': 'motion', 'min': 1, 'max': 6, 'step': 0.1 }, // ease-out power; 1 = constant speed
  'fade': { 'folder': 'motion', 'min': 0.01, 'max': 1, 'step': 0.01 }, // a digit going out
  'fadeLead': { 'folder': 'motion', 'min': 0, 'max': 1, 'step': 0.01 }, // seconds before the new value lands that the old starts fading
  'trailTime': { 'folder': 'motion', 'min': 0, 'max': 0.3, 'step': 0.005 }, // trail = distance covered in this long
  'trailMax': { 'folder': 'motion', 'min': 0, 'max': 12, 'step': 0.1 }, // cells
  // route.ts
  'legMin': { 'folder': 'route', 'min': 1, 'max': 8, 'step': 1 }, // cells per straight leg
  'legMax': { 'folder': 'route', 'min': 1, 'max': 12, 'step': 1 },
  'outward': { 'folder': 'route', 'min': 0, 'max': 1, 'step': 0.01 }, // chance a turn heads away from the clock
  'maxLegs': { 'folder': 'route', 'min': 0, 'max': 16, 'step': 1 },
  'spawnMargin': { 'folder': 'route', 'min': 0, 'max': 10, 'step': 0.5 }, // cells past the frame edge a line starts
  'seed': { 'folder': 'route', 'min': 0, 'max': 999, 'step': 1 },
  // look
  'lineWidth': { 'folder': 'look', 'min': 0.01, 'max': 0.5, 'step': 0.005 }, // cells
  'inset': { 'folder': 'look', 'min': 0, 'max': 0.3, 'step': 0.005 }, // gap at each end of a segment, cells
  'brightness': { 'folder': 'look', 'min': 0, 'max': 10, 'step': 0.05 }, // above bloomThreshold = blooms
  'exposure': { 'folder': 'look', 'min': 0.1, 'max': 4, 'step': 0.05 },
  'gridExtent': { 'folder': 'look', 'min': 4, 'max': 80, 'step': 1 }, // half size of the grid, cells
  'gridFadeNear': { 'folder': 'look', 'min': 0, 'max': 40, 'step': 0.5 },
  'gridFadeFar': { 'folder': 'look', 'min': 1, 'max': 80, 'step': 0.5 },
  // grid.ts -- the plane under the grid lines
  'markSize': { 'folder': 'grid', 'min': 0, 'max': 0.3, 'step': 0.005 }, // arm length of the X on each grid point, cells; 0 = none
  'markWidth': { 'folder': 'grid', 'min': 0.005, 'max': 0.2, 'step': 0.005 }, // bar width of the X, cells
  // A ring of light out of every digit that changes, from the moment its lines land.
  'rippleLead': { 'folder': 'grid', 'min': 0, 'max': 2, 'step': 0.05 }, // seconds before the digit lands that its ring starts
  'rippleRadius': { 'folder': 'grid', 'min': 1, 'max': 40, 'step': 0.5 }, // cells the ring has reached when it is gone
  'rippleEnergy': { 'folder': 'grid', 'min': 0, 'max': 1, 'step': 0.01 }, // how much the number of lines gathered scales the reach
  'rippleEase': { 'folder': 'grid', 'min': 1, 'max': 6, 'step': 0.1 }, // ease-out power of the spread; 1 = constant speed
  'rippleWidth': { 'folder': 'grid', 'min': 0.5, 'max': 8, 'step': 0.1 }, // cells
  'rippleLife': { 'folder': 'grid', 'min': 0.2, 'max': 6, 'step': 0.1 }, // seconds until it has faded out
  // camera (main.ts). The clock is framed to fill camFit of the screen whatever the window's shape.
  'camFov': { 'folder': 'camera', 'min': 10, 'max': 80, 'step': 1 },
  'camFit': { 'folder': 'camera', 'min': 0.1, 'max': 1, 'step': 0.01 },
  'camPitch': { 'folder': 'camera', 'min': -60, 'max': 60, 'step': 0.5 }, // degrees
  'camYaw': { 'folder': 'camera', 'min': -60, 'max': 60, 'step': 0.5 }, // degrees
  'camSwing': { 'folder': 'camera', 'min': 0, 'max': 20, 'step': 0.1 }, // degrees either way
  'camPeriod': { 'folder': 'camera', 'min': 4, 'max': 180, 'step': 1 }, // seconds per swing
  // A second, slower swing on pitch. Periods that do not divide each other never line up, so the camera
  // drifts without visibly repeating.
  'camPitchSwing': { 'folder': 'camera', 'min': 0, 'max': 20, 'step': 0.1 },
  'camPitchPeriod': { 'folder': 'camera', 'min': 4, 'max': 180, 'step': 1 },
  // pointer.ts -- the pointer's push on the camera, added on top of the swing
  'camPointerYaw': { 'folder': 'camera', 'min': 0, 'max': 30, 'step': 0.5 }, // degrees at the edge of the window
  'camPointerPitch': { 'folder': 'camera', 'min': 0, 'max': 30, 'step': 0.5 },
  'camPointerRate': { 'folder': 'camera', 'min': 0.5, 'max': 20, 'step': 0.5 }, // how quickly the camera follows; per second
  // sound.ts
  'tickVolume': { 'folder': 'sound', 'min': 0, 'max': 1, 'step': 0.01 },
  'tickHigh': { 'folder': 'sound', 'min': 200, 'max': 12000, 'step': 10 }, // Hz, on even seconds
  'tickLow': { 'folder': 'sound', 'min': 200, 'max': 12000, 'step': 10 }, // Hz, on odd seconds
  'tickBright': { 'folder': 'sound', 'min': 1, 'max': 6, 'step': 0.1 }, // low-pass cutoff as a multiple of the pitch
  'tickDecay': { 'folder': 'sound', 'min': 0.005, 'max': 0.3, 'step': 0.005 }, // seconds
  // colour
  'bgColor': { 'folder': 'colour', 'view': 'color' },
  'lineColor': { 'folder': 'colour', 'view': 'color' },
  'gridColor': { 'folder': 'colour', 'view': 'color' }, // additive, so this IS its brightness
  'markColor': { 'folder': 'colour', 'view': 'color' },
  'cellColor': { 'folder': 'colour', 'view': 'color' }, // a cell on a ring at full strength; black turns the rings off
  // post.ts
  'bloomStrength': { 'folder': 'post', 'min': 0, 'max': 3, 'step': 0.01 },
  'bloomRadius': { 'folder': 'post', 'min': 0, 'max': 1, 'step': 0.01 },
  'bloomThreshold': { 'folder': 'post', 'min': 0, 'max': 4, 'step': 0.01 },
  'bloomKnee': { 'folder': 'post', 'min': 0.01, 'max': 1, 'step': 0.01 },
  // Bloom resolution relative to the frame. The bloom is pure fill rate, so this is the main lever on its
  // cost. Too low and thin lines flicker in the bright pass (see post.ts).
  'bloomScale': { 'folder': 'post', 'min': 0.1, 'max': 1, 'step': 0.05 },
  'msaa': { 'folder': 'post', 'min': 0, 'max': 4, 'step': 2 },
  // quality.ts -- dynamic resolution
  'autoQuality': { 'folder': 'perf', 'min': 0, 'max': 1, 'step': 1 },
  'qualityMs': { 'folder': 'perf', 'min': 14, 'max': 60, 'step': 1 },
  'pixelRatio': { 'folder': 'perf', 'min': 0.5, 'max': 2, 'step': 0.1 },
  // ?capture only (capture.ts)
  'captureWidth': { 'folder': 'capture', 'min': 320, 'max': 3840, 'step': 2 },
  'captureHeight': { 'folder': 'capture', 'min': 320, 'max': 3840, 'step': 2 },
  'captureScale': { 'folder': 'capture', 'min': 1, 'max': 4, 'step': 0.5 },
  'captureMsaa': { 'folder': 'capture', 'min': 0, 'max': 8, 'step': 2 },
  'captureBloomScale': { 'folder': 'capture', 'min': 0.25, 'max': 2, 'step': 0.25 },
} as const satisfies Record<string, Spec>;

export type ParamKey = keyof typeof SCHEMA;
export type Params = Record<ParamKey, number>;

export const isColor = (key: ParamKey) => (SCHEMA[key] as Spec)['view'] === 'color';

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
