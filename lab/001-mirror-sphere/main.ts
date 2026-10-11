// 001-mirror-sphere — Mirror sphere
//
// A perfect mirror sphere with ribbons orbiting it, reflected via a cube map rendered every frame.
// Scope is deliberately one step on the shading side: no roughness, no Fresnel, no BRDF
// (those are 002 / 003 / 004).
//
// three.js is used as plumbing only (lab/AGENTS.md): BufferGeometry + RawShaderMaterial + own GLSL.
// No MeshStandardMaterial, no CubeCamera, no SphereGeometry, no OrbitControls, no post processing.
//
// Looping: everything is a function of `phase` (0..1 over params.loopSec), so the clip loops
// exactly — except the pointer pull, which is the one piece of state here. Record without touching
// the pointer and the loop is intact.
//
// Every uniform name below is quoted. terser mangles property names, and three looks uniforms up by
// the string that appears in the GLSL, so an unquoted name breaks in the built output only
// (docs/coding.md).

import * as THREE from 'three';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';
import { CUBE_FACE_COUNT, cubeFaceMatrix } from './cubeFaces.ts';
import { createSphereGeometry } from './sphereGeometry.ts';
import { createRibbonGeometry } from './ribbons.ts';
import { params } from './params.ts';
import mirrorVert from './mirror.vert.glsl?raw';
import mirrorFrag from './mirror.frag.glsl?raw';
import ribbonVert from './ribbon.vert.glsl?raw';
import ribbonFrag from './ribbon.frag.glsl?raw';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.lookAt(0, 0, 0);

// --- ribbons: the environment, and the thing the pointer moves ----------------------------------
const ribbonUniforms = {
  'uPhase': { value: 0 },
  'uPull': { value: 0 },
  'uTarget': { value: new THREE.Vector3() },
  'uWidth': { value: params.width },
  'uTwist': { value: params.twist },
  'uDepth': { value: params.pullDepth },
};

const ribbons = new THREE.Mesh(
  createRibbonGeometry(params),
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: ribbonVert,
    fragmentShader: ribbonFrag,
    uniforms: ribbonUniforms,
    side: THREE.DoubleSide, // they twist, so both faces are seen
  }),
);
scene.add(ribbons);

const rebuildRibbons = () => {
  ribbons.geometry.dispose();
  ribbons.geometry = createRibbonGeometry(params);
};

// --- backdrop: exists only inside the cube map ---------------------------------------------------
// A perfect mirror is invisible in an empty room: with nothing to reflect it returns black, and the
// sphere disappears except where a ribbon happens to cross it. Physically right, visually dead.
//
// So there is a room — but it is switched off for the on-screen pass, so the page stays black while
// the sphere still has something to show. The world the cube map sees does not have to be the world
// the camera sees, and that is a lever worth knowing about rather than a cheat to feel bad about.
const backdropUniforms = {
  'uLow': { value: params.backdropLow },
  'uHigh': { value: params.backdropHigh },
};

const backdrop = new THREE.Mesh(
  createSphereGeometry(30, 32, 24),
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.BackSide, // seen from inside
    uniforms: backdropUniforms,
    vertexShader: `
      in vec3 position;
      uniform mat4 projectionMatrix;
      uniform mat4 modelViewMatrix;
      out vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uLow;
      uniform float uHigh;
      in vec3 vDir;
      out vec4 outColor;
      void main() {
        // Dark, and brighter overhead: enough of a gradient to give the sphere a readable body
        // without lifting the blacks.
        outColor = vec4(vec3(mix(uLow, uHigh, smoothstep(-0.8, 1.0, vDir.y))), 1.0);
      }
    `,
  }),
);
backdrop.visible = false;
scene.add(backdrop);

// --- the subject --------------------------------------------------------------------------------
// Mipmaps are on, which is not about roughness (that is 002) but about aliasing: a mirror sphere
// minifies the environment hard near its silhouette, and without a mip chain thin ribbons break up
// into stair-steps there. texture() on a samplerCube picks the level from the reflection vector's
// derivatives on its own, so this costs nothing to use.
//
// No `samples` here: three does not implement MSAA for *cube* render targets, and asking for it
// throws inside updateMultisampleRenderTarget on the first frame (bindFramebuffer gets undefined).
// Resolution plus the mip chain is what is available.
const makeCubeTarget = (size: number) =>
  new THREE.WebGLCubeRenderTarget(size, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });

let cubeTarget = makeCubeTarget(params.cubeSize);

const mirror = new THREE.Mesh(
  // Kept at the origin with no rotation or scale, which is what makes mat3(modelMatrix) in
  // mirror.vert.glsl exactly right rather than merely close.
  createSphereGeometry(1, 96, 64),
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: mirrorVert,
    fragmentShader: mirrorFrag,
    uniforms: { 'envMap': { value: cubeTarget.texture } },
  }),
);
scene.add(mirror);

const resizeCube = () => {
  cubeTarget.dispose();
  cubeTarget = makeCubeTarget(params.cubeSize);
  (mirror.material as THREE.RawShaderMaterial).uniforms.envMap.value = cubeTarget.texture;
};

// --- pointer --------------------------------------------------------------------------------------
// The target lands on a shell around the sphere rather than on a flat plane: the ribbons live on
// that shell, so the head arrives among them instead of sliding through the middle of the mirror.
const TARGET_MIN = 1.5;
const TARGET_MAX = 2.6;
const unprojected = new THREE.Vector3();
const rayDir = new THREE.Vector3();
const hit = new THREE.Vector3();
const targetGoal = new THREE.Vector3(); // where the pointer asked for; uTarget eases toward it
let pointerDown = false;
let pullHold = 0; // decays once the pointer is up; what the smoothing below chases

const setTargetFromPointer = (clientX: number, clientY: number) => {
  unprojected
    .set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, 0.5)
    .unproject(camera);
  rayDir.copy(unprojected).sub(camera.position).normalize();

  // Point on the ray closest to the origin. The ray generally misses the shell entirely, and this
  // is the well-defined answer whether it hits or not — no intersection test, no special case.
  hit.copy(rayDir).multiplyScalar(-camera.position.dot(rayDir)).add(camera.position);

  const len = hit.length();
  if (len < 1e-3) {
    // Dead centre: the ray passes through the origin, so there is no direction left to keep.
    hit.copy(camera.position).normalize().multiplyScalar(TARGET_MIN);
  } else {
    hit.multiplyScalar(THREE.MathUtils.clamp(len, TARGET_MIN, TARGET_MAX) / len);
  }
  targetGoal.copy(hit);

  // Nothing is pulled yet, so there is no motion to be smooth about: start from the new point rather
  // than easing out of a stale one left over from the last click.
  if (ribbonUniforms.uPull.value < 0.02) ribbonUniforms.uTarget.value.copy(hit);
};

canvas.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
  setTargetFromPointer(e.clientX, e.clientY);
  pullHold = 1;
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  setTargetFromPointer(e.clientX, e.clientY);
  pullHold = 1;
});
const release = () => {
  pointerDown = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// --- cube map rendering ---------------------------------------------------------------------------
// 90 degrees and a square aspect: that is what makes 6 images tile into a seamless cube.
const faceCamera = new THREE.PerspectiveCamera(90, 1, 0.1, 100);
faceCamera.matrixAutoUpdate = false;

const renderCubeMap = () => {
  // The sphere must not appear in its own reflection. One line, and the reason is worth sitting
  // with: a cube map is a snapshot of "everything except me", taken from where I am.
  mirror.visible = false;
  backdrop.visible = true;
  for (let face = 0; face < CUBE_FACE_COUNT; face++) {
    faceCamera.matrix.copy(cubeFaceMatrix(face, mirror.position));
    faceCamera.matrixWorldNeedsUpdate = true;
    renderer.setRenderTarget(cubeTarget, face);
    renderer.render(scene, faceCamera);
  }
  renderer.setRenderTarget(null);
  backdrop.visible = false;
  mirror.visible = true;
};

// --- loop -------------------------------------------------------------------------------------------
// Exponential smoothing with a frame-rate independent step: the 1 - exp(-dt * rate) form keeps the
// same feel whether a frame took 16 ms or 50 ms, which a plain `x += (goal - x) * 0.1` does not.
// `rate` is 1 / time-constant, so 4 reaches about 63% of the way in 0.25 s.
const approach = (current: number, goal: number, rate: number, deltaTime: number) =>
  current + (goal - current) * (1 - Math.exp(-deltaTime * rate));

const fixedUpdate = (_time: number, _deltaTime: number) => {};

const update = (deltaTime: number) => {
  // The hold decays while the pointer is up, so a tap is a nudge rather than a mode.
  if (!pointerDown) pullHold *= Math.exp(-deltaTime / params.pullHoldSec);

  // Two separate things are eased, and both have to be or the motion snaps:
  //   uPull   — how much the ribbons are pulled at all
  //   uTarget — where they are pulled to
  // Easing only the first still teleports the heads whenever the pointer moves, because the
  // destination itself jumps.
  ribbonUniforms.uTarget.value.lerp(targetGoal, 1 - Math.exp(-deltaTime * params.targetEase));

  // Asymmetric: quicker to reach than to let go. Symmetric damping reads as elastic; this reads as
  // the head drifting over and then falling back into its orbit.
  const rate = pullHold > ribbonUniforms.uPull.value ? params.pullAttack : params.pullRelease;
  ribbonUniforms.uPull.value = approach(ribbonUniforms.uPull.value, pullHold, rate, deltaTime);

  // Live knobs from the debug panel. Cheap enough to copy every frame and keeps the panel honest:
  // there is no second source of truth to drift out of sync.
  ribbonUniforms.uWidth.value = params.width;
  ribbonUniforms.uTwist.value = params.twist;
  ribbonUniforms.uDepth.value = params.pullDepth;
  backdropUniforms.uLow.value = params.backdropLow;
  backdropUniforms.uHigh.value = params.backdropHigh;
  if (camera.position.z !== params.cameraZ) {
    camera.position.set(0, 0, params.cameraZ);
    camera.lookAt(0, 0, 0);
  }
};

const render = (phase: number) => {
  ribbonUniforms.uPhase.value = phase;
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
const phaseOf = (time: number) => ((time - startTime) % params.loopSec) / params.loopSec;

const fixedTimer = createTimeAccumulator(60, fixedUpdate);
const frameTimer = createTimeSkipper(60, (time, deltaTime) => {
  update(deltaTime);
  render(phaseOf(time));
});

const tick = () => {
  const time = getCurrentRealTime();
  execTimeAccumulator(fixedTimer, time);
  execTimeSkipper(frameTimer, time);
  window.requestAnimationFrame(tick);
};

camera.position.set(0, 0, params.cameraZ);
startTimeAccumulator(fixedTimer, startTime);
startTimeSkipper(frameTimer, startTime);
setSize();
window.addEventListener('resize', setSize);
window.requestAnimationFrame(tick);

// --- debug ------------------------------------------------------------------------------------------
// Dynamic import so Tweakpane lands in its own chunk and never loads for a recording.
if (!new URLSearchParams(location.search).has('clean')) {
  const { createDebugPane } = await import('./debug.ts');
  createDebugPane(params, rebuildRibbons, resizeCube);
}
