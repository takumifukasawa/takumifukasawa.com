// carapace — Carapace
//
// Greeble on a body instead of on a plane. "Greeble" is the ILM term for the meaningless surface detail
// that makes a model read as huge (aka nurnie; the manual counterpart is kitbash), and it is normally
// applied in a model's UV space -- which is exactly what happens here.
//
// The procedural core, unchanged from the flat version (lab/greeble/):
//   subdivide.ts  footprints (recursive rectangular subdivision) -- now read as UV, not as ground
//   height.ts     per-cell hash heights (not noise -- noise reads as terrain)
//   growth.ts     which block rises when, and the curve it rises on
//   surface.ts    THE difference: where a UV rectangle lands on pod.glb, and which way is up there
//   pod.blender.py  how pod.glb was made (parametric grid, so u runs around and v along, one seam)
// Everything here is plumbing: scene, camera, light, the render loop.
//
// The whole piece is a loop. Every time-dependent value is a function of (time mod loopPeriod) with no
// integration and no stored state, so the recording closes exactly (decision 0005).
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - No absolute paths starting with `/`; the build output may be moved.
// - Debug UI is hidden when `?clean` is present (for recording).
// - No classes: plain state objects + functions, so unused code is tree-shaken (docs/coding.md).
// - fixedUpdate: fixed 60 Hz (time/timeAccumulator.ts). update / render: capped at 60 fps (time/timeSkipper.ts).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createField, disposeField, updateBlocks, type Blocks } from './blocks.ts';
import { createDebug } from './debug.ts';
import { loadParams } from './params.ts';
import { createPost } from './post.ts';
import { subdivide } from './subdivide.ts';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createMeshSurface } from './surface.ts';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
// Values come from params.json, never from code (the debug pane's save button writes that file).
const params = loadParams();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in three r186
// Filmic, not linear: the emissive bars run well past 1.0 and linear clipping turns them into flat orange
// blobs. OutputPass at the end of the composer is what actually applies this.
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);

// Metal with nothing to reflect renders black, so a metallic material needs an environment before it is a
// material at all. RoomEnvironment is three's built-in stand-in; swapping it for a real HDRI later changes
// only this block.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
// Intensities and fog distances are applied per frame from params (all LIVE_KEYS), so the look can be
// tuned by eye from the pane and saved. Nothing about the look is decided in this file.
const FOG_COLOR = 0x05070a;
scene.fog = new THREE.Fog(FOG_COLOR, 1, 2);

// Far enough back that the whole body is in frame: greeble only reads as greeble at the density scale,
// and from close up the identical geometry reads as architecture.
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

// The camera orbits by a few degrees over the loop. A full revolution would read as a turntable; this reads
// as parallax, which is what makes a field of boxes look like it has depth. sin() over the loop period is
// periodic by construction, so it cannot be what breaks the loop.
const orbit = { 'radius': 1, 'height': 1, 'azimuth': 0, 'auto': true };

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
// Dragging takes the camera over for the rest of the session: inspecting the footprints from another angle
// is the whole reason the controls are here, and fighting the automatic motion would make that useless.
controls.addEventListener('start', () => (orbit['auto'] = false));

const key = new THREE.DirectionalLight(0xdfefff, 1);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

// Warm rim from the far side. Without it every block reads as one flat tone from the key light and the
// field loses its edges; this is also where the reference's red/orange against teal/white comes from.
const rim = new THREE.DirectionalLight(0xff7a3c, 1);
scene.add(rim);

const ambient = new THREE.HemisphereLight(0x93c5fd, 0x3a1206, 1);
scene.add(ambient);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.95, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// The body is a mesh, so nothing can be placed until it has loaded. Everything below is wired up first
// and the loop only starts once the geometry is in.
const gltf = await new GLTFLoader().loadAsync(new URL('./pod.glb', import.meta.url).href);
let geometry: THREE.BufferGeometry | undefined;
gltf.scene.traverse((child) => {
  if (!geometry && (child as THREE.Mesh).isMesh) geometry = (child as THREE.Mesh).geometry;
});
if (!geometry) throw new Error('pod.glb has no mesh');
const surface = createMeshSurface(geometry, params);

let field: Blocks[] = [];

// Called at startup and whenever a knob outside LIVE_KEYS changes. The footprints, heights, per-cell delays
// and materials are all computed here, once -- never per frame.
const rebuild = () => {
  for (const blocks of field) scene.remove(blocks['mesh']);
  disposeField(field);

  // Everything in the world is sized off the body now, not off the subdivision domain.
  const radius = params['radius'];

  ground.scale.set(radius * 12, radius * 12, 1);
  ground.position.y = -radius * 1.9;
  controls.target.set(0, 0, 0);

  // The body is elongated, so its bounding sphere is much bigger than what it actually fills. Framing off
  // the sphere leaves it small and lost in the middle of the frame.
  orbit['radius'] = radius * 2.9;
  orbit['height'] = radius * 0.65;
  orbit['azimuth'] = Math.PI * 0.08;

  key.position.set(-1, 2.2, 1.6).multiplyScalar(radius * 2);
  key.shadow.camera.left = -radius * 1.8;
  key.shadow.camera.right = radius * 1.8;
  key.shadow.camera.top = radius * 1.8;
  key.shadow.camera.bottom = -radius * 1.8;
  key.shadow.camera.far = radius * 10;
  key.shadow.camera.updateProjectionMatrix();
  rim.position.set(1.4, 0.4, -1.6).multiplyScalar(radius * 2);

  const cells = subdivide(params);
  field = createField(cells, params);
  for (const blocks of field) scene.add(blocks['mesh']);
  console.log(`[carapace] ${cells.length} cells (${field[1]?.['cells'].length ?? 0} bars)`);
};

const post = createPost(renderer, scene, camera, params);
const debug = createDebug(params, rebuild);

const setSize = () => {
  // Never above the device's own ratio: rendering more pixels than the screen has is pure cost.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, params['pixelRatio']));
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  post['setSize'](w, h);
};

const fixedUpdate = (_time: number, _deltaTime: number) => {};

let appliedPixelRatio = 0;

const update = (time: number, deltaTime: number) => {
  debug['tick'](deltaTime);
  // Changing the resolution means reallocating every render target, so only on an actual change.
  if (params['pixelRatio'] !== appliedPixelRatio) {
    appliedPixelRatio = params['pixelRatio'];
    setSize();
  }
  if (orbit['auto']) {
    const swing = Math.sin((time / params['loopPeriod']) * Math.PI * 2) * params['camSwing'];
    const azimuth = orbit['azimuth'] + swing;
    camera.position.set(Math.cos(azimuth) * orbit['radius'], orbit['height'], Math.sin(azimuth) * orbit['radius']);
    camera.lookAt(controls.target);
  } else {
    controls.update();
  }

  renderer.toneMappingExposure = params['exposure'];
  key.intensity = params['keyLight'];
  rim.intensity = params['rimLight'];
  ambient.intensity = params['ambient'];
  scene.environmentIntensity = params['ambient'] * 0.6;
  const fog = scene.fog as THREE.Fog;
  fog.near = params['radius'] * params['fogNear'];
  fog.far = params['radius'] * params['fogFar'];
  post['apply'](params);
  for (const blocks of field) updateBlocks(blocks, time, params, surface);
};

const render = (_time: number, _deltaTime: number) => {
  post['composer'].render();
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

rebuild();

const startTime = getCurrentRealTime();
startTimeAccumulator(fixedTimer, startTime);
startTimeSkipper(frameTimer, startTime);
setSize();
window.addEventListener('resize', setSize);
window.requestAnimationFrame(tick);
