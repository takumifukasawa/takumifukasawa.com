// Tweakpane panel. Loaded with a dynamic import so the library never enters the first chunk
// (docs/coding.md: keep the bundle small), and skipped entirely when ?clean is present (decision
// 0004: recordings must not have UI in frame).
//
// Every key in `params` is quoted. Tweakpane binds by string, and terser mangles property names,
// so an unquoted key works in dev and silently breaks in the built output.

import { Pane } from 'tweakpane';
import type { Params } from './params.ts';

export const createDebugPane = (params: Params, onRebuildRibbons: () => void, onResizeCube: () => void) => {
  const pane = new Pane({ title: '001-mirror-sphere' });

  const look = pane.addFolder({ title: 'ribbon (live)' });
  look.addBinding(params, 'width', { min: 0.01, max: 0.3, step: 0.001 });
  look.addBinding(params, 'twist', { min: 0, max: 6, step: 0.01 });
  look.addBinding(params, 'colorHead');
  look.addBinding(params, 'colorTail');
  // How far the per-ribbon hues spread around the pair above, in turns.
  look.addBinding(params, 'hueSpread', { min: 0, max: 0.5, step: 0.005 });
  // Pushed above 1.0 so the heads have headroom for the bloom to pick up.
  look.addBinding(params, 'intensity', { min: 0.2, max: 6, step: 0.05 });

  const shape = pane.addFolder({ title: 'ribbon (rebuilds geometry)' });
  for (const [key, opts] of [
    ['count', { min: 1, max: 40, step: 1 }],
    ['radiusMin', { min: 1.05, max: 4, step: 0.01 }],
    ['radiusMax', { min: 1.05, max: 4, step: 0.01 }],
    ['tailMin', { min: 0.02, max: 1, step: 0.01 }],
    ['tailMax', { min: 0.02, max: 1, step: 0.01 }],
  ] as const) {
    shape.addBinding(params, key, opts).on('change', onRebuildRibbons);
  }

  const pull = pane.addFolder({ title: 'pointer pull' });
  pull.addBinding(params, 'pullAttack', { min: 0.5, max: 20, step: 0.1 });
  pull.addBinding(params, 'pullRelease', { min: 0.2, max: 10, step: 0.1 });
  pull.addBinding(params, 'pullHoldSec', { min: 0.05, max: 3, step: 0.01 });
  pull.addBinding(params, 'pullDepth', { min: 0.3, max: 6, step: 0.1 });
  // Sphere radius is 1, so anything above that keeps the ribbon clear of it; the slack covers the
  // ribbon's own half width and the twist.
  pull.addBinding(params, 'minRadius', { min: 1.0, max: 2.5, step: 0.01 });
  pull.addBinding(params, 'targetEase', { min: 0.5, max: 20, step: 0.1 });

  const bloom = pane.addFolder({ title: 'bloom' });
  bloom.addBinding(params, 'bloomThreshold', { min: 0, max: 3, step: 0.01 });
  bloom.addBinding(params, 'bloomSoft', { min: 0.01, max: 1, step: 0.01 });
  bloom.addBinding(params, 'bloomStrength', { min: 0, max: 4, step: 0.01 });

  const scene = pane.addFolder({ title: 'scene' });
  scene.addBinding(params, 'cameraZ', { min: 2, max: 14, step: 0.05 });
  scene.addBinding(params, 'backdropLow');
  scene.addBinding(params, 'backdropHigh');
  scene.addBinding(params, 'loopSec', { min: 2, max: 30, step: 0.5 });
  scene
    .addBinding(params, 'cubeSize', { options: { '256': 256, '512': 512, '1024': 1024, '2048': 2048 } })
    .on('change', onResizeCube);
  // Mip chains on a cube map are built per face, so at coarse levels each face averages only its own
  // pixels and the six of them stop agreeing — which reads as visible face boundaries on a mirror.
  scene.addBinding(params, 'cubeMipmaps').on('change', onResizeCube);
  // Tints the reflection by which cube face it samples. A seam is a hard edge where two tints meet.
  scene.addBinding(params, 'showFaces');
  // A/B against three's own CubeCamera. If the seams vanish with this on, the hand-written face
  // orientations in cubeFaces.ts are wrong; if they stay, the cause is elsewhere.
  scene.addBinding(params, 'useThreeCubeCamera').on('change', onResizeCube);
  // The cube map itself, laid out as a cross: faces that share an edge are drawn next to each other,
  // so a mismatch shows as a step along that border instead of having to be inferred from the sphere.
  scene.addBinding(params, 'showCubeCross');

  return pane;
};
