// Post-processing: scene -> bloom -> chromatic aberration -> output. Plumbing, three's own passes, plus a small
// shader for the aberration.
//
// Cost. The scene itself is nearly free (a few hundred quads and the grid's lines), so the frame is almost
// entirely the bloom, and the bloom is pure fill rate: a bright pass plus a 5-level blur pyramid, each
// level a horizontal and a vertical pass. What keeps it cheap:
//   - bloomScale: the pyramid runs at a fraction of the frame. It is a blur, nobody sees its resolution --
//     up to the point where thin lines start flickering in the bright pass, which is what MSAA is for.
//   - MSAA on the scene target rather than a higher bloomScale: a 1-2 px line that covers a pixel on one
//     frame and misses it on the next feeds the bloom a different amount every frame; MSAA steadies it for
//     the cost of one resolve, where raising bloomScale multiplies every blur pass.
//   - the canvas has no antialias (main.ts): it only ever receives OutputPass's full-screen quad.
//   - quality.ts lowers pixel ratio first, then bloomScale, when frames run long.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Params } from './params.ts';

// Red and blue pulled apart along the line from the centre, as a lens does: none in the middle, most at the
// corners, where uAmount is the shift as a share of the distance from the centre. Before OutputPass, so it
// works on the linear HDR frame and the bloom's glow splits too.
const ChromaticAberration = {
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 shift = (vUv - 0.5) * uAmount;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + shift).r;
      c.b = texture2D(tDiffuse, vUv - shift).b;
      gl_FragColor = c;
    }`,
};

export type Post = {
  composer: EffectComposer;
  setSize: (width: number, height: number, bloomScale: number) => void;
  apply: (params: Params) => void;
};

export const createPost = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  params: Params,
): Post => {
  // Half float so the lines' HDR brightness survives into the bright pass.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: params.msaa });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1, 0, 1);
  composer.addPass(bloom);
  const aberration = new ShaderPass(ChromaticAberration);
  composer.addPass(aberration);
  // Tone mapping and colour space; must be last.
  composer.addPass(new OutputPass());

  return {
    composer,
    setSize: (width, height, bloomScale) => {
      // EffectComposer reads the renderer's pixel ratio only in its constructor (docs/learnings.md).
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(width, height);
      // After composer.setSize, which resizes every pass to the full frame. bloom.setSize takes device
      // pixels' worth of CSS size, so multiply the pixel ratio back in.
      const ratio = renderer.getPixelRatio();
      bloom.setSize(Math.max(1, Math.round(width * ratio * bloomScale)), Math.max(1, Math.round(height * ratio * bloomScale)));
    },
    apply: (next) => {
      if (composer.renderTarget1.samples !== next.msaa) {
        for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
          rt.samples = next.msaa;
          rt.dispose();
        }
      }
      bloom.strength = next.bloomStrength;
      bloom.radius = next.bloomRadius;
      bloom.threshold = next.bloomThreshold;
      aberration.uniforms.uAmount!.value = next.chromaticAberration;
      aberration.enabled = next.chromaticAberration > 0;
      // three hardcodes the high pass's soft knee at 0.01, a step: a line fading out would drop out of the
      // bloom all at once. Widened, it leaves the bloom as it fades.
      // @types/three types highPassUniforms as a bare object; at run time it is the shader's uniforms.
      (bloom.highPassUniforms as Record<string, THREE.IUniform>).smoothWidth!.value = next.bloomKnee;
    },
  };
};
