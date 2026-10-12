// Post-processing. Plumbing: three's own passes, wired in the order the reference reads as.
//
// Bloom is what makes the emissive bars read as light rather than as orange paint, and chromatic aberration
// at the frame edges is one of the signatures of the reference (an HDRP physical camera look). Both are
// knobs in params.json, so tuning them never touches this file.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import aberrationFrag from './aberration.frag.glsl?raw';
import type { Params } from './params.ts';

export type Post = {
  'composer': EffectComposer;
  'setSize': (width: number, height: number) => void;
  'apply': (params: Params) => void;
};

export const createPost = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  params: Params,
): Post => {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

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
    'setSize': (width, height) => {
      composer.setSize(width, height);
      bloom.resolution.set(width, height);
    },
    'apply': (next) => {
      bloom.strength = next['bloomStrength'];
      bloom.radius = next['bloomRadius'];
      bloom.threshold = next['bloomThreshold'];
      aberration.uniforms['uAmount']!.value = next['aberration'];
    },
  };
};
