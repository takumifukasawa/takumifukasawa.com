// The 6 camera orientations for rendering into a cube map.
//
// A cube map is 6 square images, each the view from one point looking down one axis with a 90-degree
// field of view. To fill it, you render the scene 6 times, moving only the camera's orientation.
//
// Face order is fixed by WebGL / three.js:
//   0: +X   1: -X   2: +Y   3: -Y   4: +Z   5: -Z
//
// The up vectors are the part that has to match a convention rather than be derived. Two things set
// it: cube map faces are laid out with their own axis convention (inherited from RenderMan via
// D3D/GL), and three.js samples a render-target cube texture without the x flip it applies to
// *loaded* cube textures. So the orientations below are the ones that make three's sampler agree
// with what was rendered — they mirror what THREE.CubeCamera sets up internally.
//
// ±Y are the interesting ones. Looking straight up or straight down, "up" is degenerate: any vector
// in the XZ plane would do as far as the maths is concerned, and only the convention decides which.
//
// These are the WebGL values. three flips several of them for WebGPU (THREE.CubeCamera
// updateCoordinateSystem), so they are a property of the backend, not of cube maps in general.
// They were wrong here on the first pass — both ±Y up vectors inverted — and the render looked
// *fine*, because this scene has nothing above or below the sphere for those faces to show. It
// would have surfaced in 002, where roughness blurs across face boundaries. Checking against
// three/src/cameras/CubeCamera.js was the only way to see it.

import * as THREE from 'three';

export const CUBE_FACE_COUNT = 6;

const FACES: { dir: THREE.Vector3; up: THREE.Vector3 }[] = [
  { dir: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) }, // +X
  { dir: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) }, // -X
  { dir: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) }, // +Y
  { dir: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) }, // -Y
  { dir: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) }, // +Z
  { dir: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) }, // -Z
];

const matrix = new THREE.Matrix4();
const target = new THREE.Vector3();

export const cubeFaceMatrix = (face: number, center: THREE.Vector3): THREE.Matrix4 => {
  const { dir, up } = FACES[face];
  target.copy(center).add(dir);

  // Matrix4.lookAt builds the rotation only, as a camera basis: the columns are (right, up, backward),
  // because a camera looks down its own -Z. That -Z convention is the other place this goes wrong —
  // build the basis with `forward` in the third column instead of `backward` and every face is
  // mirrored.
  matrix.lookAt(center, target, up);
  matrix.setPosition(center);
  return matrix;
};
