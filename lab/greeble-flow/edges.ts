// Plumbing for the box edges: hands edge.glsl the box-local position and the instance's real size, and the
// knobs as uniforms. What an edge IS and what it does to the colour lives in edge.glsl, not here.
import * as THREE from 'three';
import edgeChunk from './edge.glsl?raw';
import type { Params } from './params.ts';

// One set shared by every material that has edges: written once per frame from params, never per material.
const uniforms = {
  'uEdgeColor': { 'value': new THREE.Color() },
  'uEdgeWidth': { 'value': 0 },
  'uEdgeStrength': { 'value': 0 },
};

export const withEdges = (material: THREE.MeshStandardMaterial) => {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const varyings = 'varying vec3 vBoxLocal;\nvarying vec3 vBoxSize;\n';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${varyings}`)
      // `position` is the unit box (blocks.ts boxGeometry). The column lengths of instanceMatrix are the
      // per-axis scale only because the basis is orthonormal (blocks.ts makeBasis on the plane).
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vBoxLocal = position;
#ifdef USE_INSTANCING
vBoxSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
#else
vBoxSize = vec3(1.0);
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${varyings}uniform vec3 uEdgeColor;\nuniform float uEdgeWidth;\nuniform float uEdgeStrength;\n${edgeChunk}`,
      )
      // After the emissive map: diffuseColor and totalEmissiveRadiance both exist, and lighting has not run.
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nedge(diffuseColor.rgb, totalEmissiveRadiance, vBoxLocal, vBoxSize);',
      );
  };
};

export const applyEdges = (params: Params) => {
  uniforms['uEdgeColor']['value'].setHex(params['edgeColor']);
  uniforms['uEdgeWidth']['value'] = params['edgeWidth'];
  uniforms['uEdgeStrength']['value'] = params['edgeStrength'];
};
