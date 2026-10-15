// Post-processing. Plumbing: three's own passes, wired in the order the reference reads as.
//
// Bloom is what makes the emissive bars read as light rather than as orange paint, and chromatic aberration
// at the frame edges is one of the signatures of the reference (an HDRP physical camera look). Both are
// knobs in params.json, so tuning them never touches this file.
import * as THREE from 'three';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import aberrationFrag from './aberration.frag.glsl?raw';
import type { Params } from './params.ts';
import type { Tier } from './quality.ts';

export type Post = {
  'composer': EffectComposer;
  'setSize': (width: number, height: number, bloomScale: number) => void;
  'apply': (params: Params, tier: Tier) => void;
};

export const createPost = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  params: Params,
): Post => {
  // An explicit target so it can carry MSAA. antialias is off on the canvas (main.ts), and the canvas only
  // receives the final full-screen quad anyway -- the scene is drawn here, so this is where edges get
  // smoothed or don't. It matters for bloom more than for edges: a 1-2 px streak that covers a pixel on one
  // frame and misses it on the next feeds the bright pass a different amount of light every frame, and the
  // bloom shows that as flicker. Half float, same as three's default target, so HDR survives into bloom.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: params['msaa'] });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  // Depth of field, before bloom: in a real camera the lens defocuses and the sensor blooms, in that order.
  //
  // THIS IS THE EXPENSIVE PASS. BokehPass draws the whole scene a second time with a depth override
  // material to build its depth map, so the geometry cost roughly doubles. That is why `dofAperture: 0`
  // disables the pass outright rather than just setting the aperture to zero -- a phone that cannot afford
  // it should not pay for a second geometry pass that produces no visible blur.
  const bokeh = new BokehPass(scene, camera, { focus: 1, aperture: 0, maxblur: 0.01 });
  composer.addPass(bokeh);

  // The bloom resolution arrives through setSize rather than being captured here, because quality.ts can
  // lower it. Keep it at 1 where possible: below that the bright pass samples the frame sparsely and thin
  // lights flicker (mobile-audio-render skill, references/render-cost.md).
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    params['bloomStrength'],
    params['bloomRadius'],
    params['bloomThreshold'],
  );
  composer.addPass(bloom);

  const aberration = new ShaderPass({
    uniforms: {
      'tDiffuse': { value: null },
      'uAmount': { value: params['aberration'] },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: aberrationFrag,
  });
  composer.addPass(aberration);

  // OutputPass does the tone mapping and the colour-space conversion, so it must come last. Without it the
  // composer's intermediate targets stay linear and everything renders washed out.
  composer.addPass(new OutputPass());

  return {
    'composer': composer,
    'setSize': (width, height, bloomScale) => {
      // EffectComposer reads the renderer's pixel ratio once, in its constructor -- which runs before
      // main.ts first sets it, so it stayed at 1 and the scene was drawn at CSS size whatever `pixelRatio`
      // said (only the final copy to the canvas got bigger). Hand it the current ratio on every resize.
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
      // setSize, not `resolution.set`: assigning the vector leaves the pass's render targets at their old
      // size, so bloom silently stopped following window resizes. Scaled down because the bloom pyramid is
      // pure fill rate and nobody can see its resolution -- it is a blur.
      bloom.setSize(Math.max(1, width * bloomScale), Math.max(1, height * bloomScale));
    },
    'apply': (next, tier) => {
      // The aperture knob is scaled here, not in params.json. three's shader computes
      //   dofblur = clamp((focus + viewZ) * aperture, -maxblur, maxblur)
      // where (focus + viewZ) is the distance from the focal plane in WORLD units -- about +-20 at this
      // field size. So the useful aperture is around 0.0005, which is unreadable in a slider and easy to
      // get wrong by a factor of ten (it was, the first time). The knob is 0..3; 1 means "the far edge of
      // the field reaches maxblur".
      // The tier can switch it off outright, which is the point of disabling the pass rather than zeroing
      // the aperture: a device that cannot hold its frame rate should not be paying for the second
      // geometry pass at all.
      bokeh.enabled = tier['dof'] && next['dofAperture'] > 0;
      if (bokeh.enabled) {
        const uniforms = bokeh.materialBokeh.uniforms;
        uniforms['focus']!.value = next['size'] * next['dofFocus'];
        uniforms['aperture']!.value = (next['dofAperture'] * next['dofMaxBlur']) / (next['size'] * 0.85);
        uniforms['maxblur']!.value = next['dofMaxBlur'];
      }
      // Live: the sample count can change on existing targets, but only takes effect once they are
      // reallocated, which dispose() arranges for the next render.
      if (composer.renderTarget1.samples !== next['msaa']) {
        for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
          rt.samples = next['msaa'];
          rt.dispose();
        }
      }
      bloom.strength = next['bloomStrength'];
      bloom.radius = next['bloomRadius'];
      bloom.threshold = next['bloomThreshold'];
      // The soft knee of the high pass, which three hardcodes at 0.01 -- effectively a step. A pixel
      // whose brightness crosses the threshold is therefore either fully in the bloom or fully out, and
      // on a moving camera, specular highlights and thin emissive bars cross it constantly: that is what
      // reads as bloom flickering. Widening the knee makes them fade in and out instead of switching.
      bloom.highPassUniforms['smoothWidth']!.value = next['bloomKnee'];
      aberration.uniforms['uAmount']!.value = next['aberration'];
    },
  };
};
