// Every key is quoted: Tweakpane binds by string and terser mangles property names, so an unquoted
// key works in dev and silently breaks in the built output (docs/coding.md).
import { defaultRibbonOptions } from './ribbons.ts';

export type Params = {
  width: number;
  twist: number;
  colorHead: string;
  colorTail: string;
  hueSpread: number;
  intensity: number;
  count: number;
  emitWindow: number;
  tailMin: number;
  tailMax: number;
  pullAttack: number;
  pullRelease: number;
  pullHoldSec: number;
  pullDepth: number;
  minRadius: number;
  emitterRadius: number;
  drift: number;
  spread: number;
  pointSize: number;
  targetEase: number;
  cameraZ: number;
  backdropLow: string;
  backdropHigh: string;
  bloomThreshold: number;
  bloomSoft: number;
  bloomStrength: number;
  loopSec: number;
  cubeSize: number;
  cubeMipmaps: boolean;
  showFaces: boolean;
  useThreeCubeCamera: boolean;
  showCubeCross: boolean;
};

export const params: Params = {
  'width': 0.009,
  'twist': 1.25,
  'colorHead': '#eafaff',
  'colorTail': '#17c8ff',
  'hueSpread': 0.14,
  'intensity': 1.15,
  'count': defaultRibbonOptions.count,
  'emitWindow': defaultRibbonOptions.emitWindow,
  'tailMin': defaultRibbonOptions.tailMin,
  'tailMax': defaultRibbonOptions.tailMax,
  'pullAttack': 4.5,
  'pullRelease': 2.2,
  'pullHoldSec': 0.5,
  'pullDepth': 2,
  'minRadius': 1.18,
  'emitterRadius': 1.9,
  'drift': 0.35,
  'spread': 0.25,
  'pointSize': 0.05,
  'targetEase': 5,
  'cameraZ': 7.6,
  'backdropLow': '#070a16',
  'backdropHigh': '#2e7596',
  'bloomThreshold': 0.75,
  'bloomSoft': 0.35,
  'bloomStrength': 1.1,
  'loopSec': 10,
  'cubeSize': 1024,
  'cubeMipmaps': false,
  'showFaces': false,
  'useThreeCubeCamera': true,
  'showCubeCross': false,
};
