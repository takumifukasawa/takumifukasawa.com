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
  radiusMin: number;
  radiusMax: number;
  tailMin: number;
  tailMax: number;
  pullAttack: number;
  pullRelease: number;
  pullHoldSec: number;
  pullDepth: number;
  minRadius: number;
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
  'width': 0.075,
  'twist': 1.25,
  'colorHead': '#eafaff',
  'colorTail': '#17c8ff',
  'hueSpread': 0.08,
  'intensity': 2.6,
  'count': defaultRibbonOptions.count,
  'radiusMin': defaultRibbonOptions.radiusMin,
  'radiusMax': defaultRibbonOptions.radiusMax,
  'tailMin': defaultRibbonOptions.tailMin,
  'tailMax': defaultRibbonOptions.tailMax,
  'pullAttack': 4.5,
  'pullRelease': 2.2,
  'pullHoldSec': 0.5,
  'pullDepth': 2,
  'minRadius': 1.18,
  'targetEase': 5,
  'cameraZ': 5.4,
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
