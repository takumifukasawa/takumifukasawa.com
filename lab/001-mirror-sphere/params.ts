// Every key is quoted: Tweakpane binds by string and terser mangles property names, so an unquoted
// key works in dev and silently breaks in the built output (docs/coding.md).
import { defaultRibbonOptions } from './ribbons.ts';

export type Params = {
  width: number;
  twist: number;
  count: number;
  radiusMin: number;
  radiusMax: number;
  tailMin: number;
  tailMax: number;
  pullAttack: number;
  pullRelease: number;
  pullHoldSec: number;
  pullDepth: number;
  targetEase: number;
  cameraZ: number;
  backdropLow: number;
  backdropHigh: number;
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
  'count': defaultRibbonOptions.count,
  'radiusMin': defaultRibbonOptions.radiusMin,
  'radiusMax': defaultRibbonOptions.radiusMax,
  'tailMin': defaultRibbonOptions.tailMin,
  'tailMax': defaultRibbonOptions.tailMax,
  'pullAttack': 4.5,
  'pullRelease': 2.2,
  'pullHoldSec': 0.5,
  'pullDepth': 2,
  'targetEase': 5,
  'cameraZ': 5.4,
  'backdropLow': 0.02,
  'backdropHigh': 0.3,
  'loopSec': 10,
  'cubeSize': 1024,
  'cubeMipmaps': false,
  'showFaces': false,
  'useThreeCubeCamera': true,
  'showCubeCross': false,
};
