// greeble — Greeble
//
// Dense fields of small axis-aligned boxes extruded from a plane. "Greeble" is the ILM term for the
// meaningless surface detail that makes a model read as huge (aka nurnie; the manual counterpart is
// kitbash). What makes it greeble rather than a city is the *footprint distribution*: a strict Manhattan
// grid of wildly unequal rectangles.
//
// The subject of this sketch -- written by hand, not by the agent (AGENTS.md):
//   subdivide.ts  footprints (recursive rectangular subdivision)
//   height.ts     per-cell hash heights (not noise -- noise reads as terrain)
//   growth.ts     which block rises when, and the curve it rises on
// Everything here is plumbing: scene, camera, light, the render loop.
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - No absolute paths starting with `/`; the build output may be moved.
// - Debug UI is hidden when `?clean` is present (for recording).
// - No classes: plain state objects + functions, so unused code is tree-shaken (docs/coding.md).
// - fixedUpdate: fixed 60 Hz (time/timeAccumulator.ts). update / render: capped at 60 fps (time/timeSkipper.ts).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createBlocks, updateBlocks, type Blocks } from './blocks.ts';
import { createDebug } from './debug.ts';
import { loadParams } from './params.ts';
import { subdivide } from './subdivide.ts';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
// Values come from params.json, never from code (the debug pane's save button writes that file).
const params = loadParams();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in three r186

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);

// Metal with nothing to reflect renders black, so a metallic material needs an environment before it is a
// material at all. RoomEnvironment is three's built-in stand-in; swapping it for a real HDRI later changes
// only this block.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
scene.fog = new THREE.Fog(0x05070a, params['size'] * 0.9, params['size'] * 2.8);

// Low, shallow angle: looking across the field rather than down at it is what makes the boxes read as
// structures. Straight down turns the whole thing into a floor plan.
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
// Far enough back that the whole field is in frame. Greeble only reads as greeble at the density scale --
// from inside it, the identical geometry reads as a city.
camera.position.set(params['size'] * 0.95, params['size'] * 0.5, params['size'] * 1.3);
camera.lookAt(0, params['heightMax'] * 0.25, 0);

// Orbit while writing subdivide / height / growth: the footprint pattern is impossible to judge from one
// fixed angle. Not part of the recorded look -- it only moves when dragged.
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, params['heightMax'] * 0.25, 0);
controls.enableDamping = true;
controls.update();

const key = new THREE.DirectionalLight(0xdfefff, 2.6);
key.position.set(-1, 2.4, 1.6).multiplyScalar(params['size'] * 0.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
const shadowExtent = params['size'] * 0.8;
key.shadow.camera.left = -shadowExtent;
key.shadow.camera.right = shadowExtent;
key.shadow.camera.top = shadowExtent;
key.shadow.camera.bottom = -shadowExtent;
key.shadow.camera.far = params['size'] * 4;
scene.add(key);

// Warm bounce from below so the box sides do not go flat black; the palette is the reference's teal/white
// against red/orange.
scene.add(new THREE.HemisphereLight(0x93c5fd, 0x3a1206, 0.55));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshStandardMaterial({ color: 0x0b0f13, roughness: 0.9, metalness: 0.2 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

let blocks: Blocks | undefined;

// Called at startup and whenever a structural knob changes. The footprints are computed once here, never
// per frame -- only the growth factor is animated.
const rebuild = () => {
  if (blocks) {
    scene.remove(blocks['mesh']);
    blocks['mesh'].geometry.dispose();
    (blocks['mesh'].material as THREE.Material).dispose();
    blocks['mesh'].dispose();
  }
  const size = params['size'];
  ground.scale.set(size * 4, size * 4, 1);
  scene.fog = new THREE.Fog(0x05070a, size * 0.9, size * 2.8);
  controls.target.set(0, params['heightMax'] * 0.25, 0);

  const cells = subdivide(params);
  blocks = createBlocks(cells, params);
  scene.add(blocks['mesh']);
  console.log(`[greeble] ${cells.length} cells`);
};

const setSize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
};

const fixedUpdate = (_time: number, _deltaTime: number) => {};

const update = (time: number, _deltaTime: number) => {
  controls.update();
  if (blocks) updateBlocks(blocks, time, params);
};

const render = (_time: number, _deltaTime: number) => {
  renderer.render(scene, camera);
};

const fixedTimer = createTimeAccumulator(60, fixedUpdate);
const frameTimer = createTimeSkipper(60, (time, deltaTime) => {
  update(time, deltaTime);
  render(time, deltaTime);
});

const getCurrentRealTime = () => performance.now() / 1000;

const tick = () => {
  const time = getCurrentRealTime();
  execTimeAccumulator(fixedTimer, time);
  execTimeSkipper(frameTimer, time);
  window.requestAnimationFrame(tick);
};

createDebug(params, rebuild);
rebuild();

const startTime = getCurrentRealTime();
startTimeAccumulator(fixedTimer, startTime);
startTimeSkipper(frameTimer, startTime);
setSize();
window.addEventListener('resize', setSize);
window.requestAnimationFrame(tick);
