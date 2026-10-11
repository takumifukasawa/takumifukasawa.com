// Draws the 6 cube faces as a cross, replacing the normal view. The point is to look at the cube map
// itself instead of inferring its state from the sphere: in a cross layout the faces that actually
// share an edge are drawn next to each other, so a mismatch shows up as a step along that border.
//
//        +Y
//   -X   +Z   +X   -Z
//        -Y
//
// It takes over the whole frame rather than drawing as a corner overlay — an overlay needs viewport,
// scissor and autoClear juggling, and when it silently draws nothing the debug tool itself becomes
// the thing being debugged.
//
// The direction for a face is the standard GL cube mapping. Getting one of those signs wrong looks
// like the face is flipped, which is itself the usual bug this view is used to find.

import * as THREE from 'three';

// [face] -> [column, row] in the 4x3 cross
const LAYOUT: [number, number][] = [
  [2, 1], // +X
  [0, 1], // -X
  [1, 0], // +Y
  [1, 2], // -Y
  [1, 1], // +Z
  [3, 1], // -Z
];

const COLS = 4;
const ROWS = 3;

export const createCubeDebug = () => {
  const aFace: number[] = [];
  const aUV: number[] = [];
  const position: number[] = [];
  const index: number[] = [];

  LAYOUT.forEach(([col, row], face) => {
    const base = aFace.length;
    for (const [u, v] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      // -1..1 in both axes, matching the orthographic camera below.
      position.push(((col + (u + 1) / 2) / COLS) * 2 - 1, (1 - (row + (1 - v) / 2) / ROWS) * 2 - 1, 0);
      aUV.push(u, v);
      aFace.push(face);
    }
    index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('aUV', new THREE.Float32BufferAttribute(aUV, 2));
  geometry.setAttribute('aFace', new THREE.Float32BufferAttribute(aFace, 1));
  geometry.setIndex(index);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    uniforms: { 'envMap': { value: null as THREE.CubeTexture | null } },
    vertexShader: `
      in vec3 position;
      in vec2 aUV;
      in float aFace;
      uniform mat4 projectionMatrix;
      uniform mat4 modelViewMatrix;
      out vec2 vUV;
      out float vFace;
      void main() {
        vUV = aUV;
        vFace = aFace;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform samplerCube envMap;
      in vec2 vUV;
      in float vFace;
      out vec4 outColor;

      vec3 faceDir(int face, vec2 uv) {
        if (face == 0) return vec3( 1.0, -uv.y, -uv.x); // +X
        if (face == 1) return vec3(-1.0, -uv.y,  uv.x); // -X
        if (face == 2) return vec3( uv.x,  1.0,  uv.y); // +Y
        if (face == 3) return vec3( uv.x, -1.0, -uv.y); // -Y
        if (face == 4) return vec3( uv.x, -uv.y,  1.0); // +Z
        return vec3(-uv.x, -uv.y, -1.0);                // -Z
      }

      void main() {
        vec3 c = texture(envMap, faceDir(int(vFace + 0.5), vUV)).rgb;
        // A border so the face boundaries are unambiguous.
        float edge = max(abs(vUV.x), abs(vUV.y)) > 0.99 ? 1.0 : 0.0;
        outColor = vec4(mix(c, vec3(0.0, 0.6, 0.0), edge), 1.0);
      }
    `,
  });

  // -1..1 in both axes, which is where the geometry above is written.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));

  return {
    render(renderer: THREE.WebGLRenderer, map: THREE.CubeTexture) {
      material.uniforms.envMap.value = map;
      renderer.render(scene, camera);
    },
  };
};
