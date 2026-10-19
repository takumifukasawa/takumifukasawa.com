// Post-processing: scene -> bloom -> chromatic aberration -> output. Plumbing, three's own TSL nodes.
//
// Bloom is added on top of the scene; the aberration comes after it, so the glow splits too (same order as
// lab/voxel-rain/post.ts). RenderPipeline applies tone mapping and the color space last, on its own.
// Every strength is a uniform from params.ts, so the debug pane tunes them live.
import { RenderPipeline, type Renderer, type Scene, type Camera } from 'three/webgpu';
import { pass, vec2 } from 'three/tsl';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { chromaticAberration } from 'three/examples/jsm/tsl/display/ChromaticAberrationNode.js';
import type { Uniforms } from './params.ts';

export const createPost = (renderer: Renderer, scene: Scene, camera: Camera, uniforms: Uniforms) => {
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const glow = bloom(color, uniforms.bloomStrength, uniforms.bloomRadius, uniforms.bloomThreshold);
  const pipeline = new RenderPipeline(renderer);
  // The center is passed: three r186 documents a default for null but does not apply one.
  pipeline.outputNode = chromaticAberration(color.add(glow), uniforms.aberration, vec2(0.5, 0.5));
  return {
    render: () => pipeline.render(),
  };
};
