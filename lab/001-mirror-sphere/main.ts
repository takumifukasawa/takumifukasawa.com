// 001-mirror-sphere — Mirror sphere
//
// A perfect mirror sphere reflecting a monochrome environment, via a cube map rendered every frame.
// Scope is deliberately one step: no roughness, no Fresnel, no BRDF (those are 002 / 003 / 004).
//
// three.js is used as plumbing only (lab/AGENTS.md): BufferGeometry + RawShaderMaterial + own GLSL.
// No MeshStandardMaterial, no CubeCamera, no SphereGeometry, no OrbitControls, no post processing.
//
// Unfinished on purpose — see the TODO(you) blocks:
//   mirror.vert.glsl  world-space position / normal
//   mirror.frag.glsl  view direction, reflect, cube sample
//   cubeFaces.ts      the 6 camera orientations
// The sketch runs without them and is visibly wrong, which is the point: each one you fill in
// makes it visibly less wrong.

import * as THREE from 'three';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';
import { CUBE_FACE_COUNT, cubeFaceMatrix } from './cubeFaces.ts';
import { createSphereGeometry } from './sphereGeometry.ts';
import mirrorVert from './mirror.vert.glsl?raw';
import mirrorFrag from './mirror.frag.glsl?raw';

// Recording loops for this long (docs/spec/publish-pipeline.md). Drive every animation from `phase`
// below, never from raw time, or the clip will not loop.
const LOOP_SEC = 10;
const CUBE_SIZE = 256;

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 4.2);
camera.lookAt(0, 0, 0);

// --- the environment that gets reflected -------------------------------------------------------
// Scaffolding, provided. Monochrome, and nothing but the sphere is the subject (the visual
// constraint in AGENTS.md). BoxGeometry is fine here: the "write it yourself" rule is about the
// subject of the sketch, not about the backdrop.
const flat = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3,
  vertexShader: `
    in vec3 position;
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;
    void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    precision highp float;
    uniform float brightness;
    out vec4 outColor;
    void main() { outColor = vec4(vec3(brightness), 1.0); }
  `,
  uniforms: { brightness: { value: 1 } },
});

const env = new THREE.Group();
const bar = new THREE.BoxGeometry(0.08, 1.6, 0.08);
for (let ring = 0; ring < 2; ring++) {
  const count = 18;
  const radius = 3.0 + ring * 1.4;
  const y = ring === 0 ? -0.2 : 0.6;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const mesh = new THREE.Mesh(bar, flat);
    mesh.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    mesh.scale.y = 0.6 + (i % 3) * 0.7;
    env.add(mesh);
  }
}
scene.add(env);

// --- the subject -------------------------------------------------------------------------------
const cubeTarget = new THREE.WebGLCubeRenderTarget(CUBE_SIZE, {
  // No mipmaps: a perfect mirror samples one direction at full resolution. Roughness is what needs
  // a mip chain, and that is 002.
  generateMipmaps: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});

const mirror = new THREE.Mesh(
  // Kept at the origin with no rotation or scale, so the placeholder world-space maths in
  // mirror.vert.glsl happens to be correct. It stops being correct the moment you move it.
  createSphereGeometry(1, 96, 64),
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: mirrorVert,
    fragmentShader: mirrorFrag,
    uniforms: { envMap: { value: cubeTarget.texture } },
  }),
);
scene.add(mirror);

// --- cube map rendering ------------------------------------------------------------------------
// 90 degrees and a square aspect: that is what makes 6 images tile into a seamless cube.
const faceCamera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
faceCamera.matrixAutoUpdate = false;

const renderCubeMap = () => {
  // The sphere must not appear in its own reflection. One line, and the reason is worth sitting with:
  // a cube map is a snapshot of "everything except me", taken from where I am.
  mirror.visible = false;
  for (let face = 0; face < CUBE_FACE_COUNT; face++) {
    faceCamera.matrix.copy(cubeFaceMatrix(face, mirror.position));
    faceCamera.matrixWorldNeedsUpdate = true;
    renderer.setRenderTarget(cubeTarget, face);
    renderer.render(scene, faceCamera);
  }
  renderer.setRenderTarget(null);
  mirror.visible = true;
};

// --- loop --------------------------------------------------------------------------------------
const fixedUpdate = (_time: number, _deltaTime: number) => {};

const update = (_phase: number) => {};

const render = (phase: number) => {
  // phase is 0..1 over LOOP_SEC. Everything animated is a function of it, so the clip loops exactly.
  env.rotation.y = phase * Math.PI * 2;
  renderCubeMap();
  renderer.render(scene, camera);
};

const setSize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};

const getCurrentRealTime = () => performance.now() / 1000;
const startTime = getCurrentRealTime();
const phaseOf = (time: number) => ((time - startTime) % LOOP_SEC) / LOOP_SEC;

const fixedTimer = createTimeAccumulator(60, fixedUpdate);
const frameTimer = createTimeSkipper(60, (time) => {
  const phase = phaseOf(time);
  update(phase);
  render(phase);
});

const tick = () => {
  const time = getCurrentRealTime();
  execTimeAccumulator(fixedTimer, time);
  execTimeSkipper(frameTimer, time);
  window.requestAnimationFrame(tick);
};

startTimeAccumulator(fixedTimer, startTime);
startTimeSkipper(frameTimer, startTime);
setSize();
window.addEventListener('resize', setSize);
window.requestAnimationFrame(tick);
