// wip — the workspace sketch
//
// `wip` is not a title, it is the slug this sketch keeps WHILE it is being made. The slug becomes the URL
// the moment `pnpm lab:add` runs and is permanent after that (decision 0007), so naming a piece before
// knowing what it is produces a URL that lies -- which is exactly what happened when "greeble" turned into
// a body and the name stopped meaning anything. Rename this directory to the real slug when publishing;
// `pnpm lab:add` refuses to publish `wip` (docs/spec/publish-pipeline.md).
//
// What it currently is: a greeble floor that answers the pointer. Plates near the pointer rise; a flow
// crossing the field has to find its way around them.
//
//   subdivide.ts  footprints (recursive rectangular subdivision), grouped into plates
//   height.ts     per-plate hash heights (not noise -- noise reads as terrain)
//   growth.ts     which plate rises when, and the curve it rises on
//   surface.ts    where a domain rectangle lands in the world. A plane, here
//   lift.ts       how far each plate has risen toward the pointer
// Everything else is plumbing: scene, camera, light, the render loop.
//
// NOT a loop, unlike every earlier version of this sketch. The lift and its settle are integrated, so the
// piece cannot close into an exact cycle (decision 0005) -- which is correct, because a thing driven by a
// pointer was never going to be a recordable loop. The recording is a take, not a cycle.
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
import { createFlow, type Flow } from './flow.ts';
import { collectPlates, updateLift, type Plates } from './lift.ts';
import { createPointer } from './pointer.ts';
import { createDebug } from './debug.ts';
import { loadParams } from './params.ts';
import { createPost } from './post.ts';
import { subdivide } from './subdivide.ts';
import { createPlaneSurface } from './surface.ts';
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

const surface = createPlaneSurface(params);
const pointer = createPointer(canvas, camera);

let field: Blocks[] = [];
let plates: Plates | undefined;
let flow: Flow | undefined;

// Called at startup and whenever a knob outside LIVE_KEYS changes. The footprints, heights, per-cell delays
// and materials are all computed here, once -- never per frame.
const rebuild = () => {
  for (const blocks of field) scene.remove(blocks['mesh']);
  disposeField(field);

  // Back to the subdivision domain as the world: the surface IS the ground now.
  const size = params['size'];

  ground.scale.set(size * 4, size * 4, 1);
  ground.position.y = 0;
  controls.target.set(0, 0, 0);

  // Higher than the pure greeble framing. The flow runs across the field, and from a low angle the raised
  // plates hide the stream behind them -- the pattern of the flow has to be visible, not just its edge.
  orbit['radius'] = size * 1.35;
  orbit['height'] = size * 0.85;
  orbit['azimuth'] = Math.PI * 0.25;

  key.position.set(-1, 2.4, 1.6).multiplyScalar(size * 0.5);
  key.shadow.camera.left = -size * 0.8;
  key.shadow.camera.right = size * 0.8;
  key.shadow.camera.top = size * 0.8;
  key.shadow.camera.bottom = -size * 0.8;
  key.shadow.camera.far = size * 4;
  key.shadow.camera.updateProjectionMatrix();
  rim.position.set(1.4, 0.6, -1.6).multiplyScalar(size * 0.5);

  if (flow) {
    scene.remove(flow['object']);
    flow['dispose']();
  }
  flow = createFlow(params);
  scene.add(flow['object']);

  const cells = subdivide(params);
  plates = collectPlates(cells);
  field = createField(cells, params, surface, plates);
  for (const blocks of field) scene.add(blocks['mesh']);
  const placed = field.reduce((n, b) => n + b['cells'].length, 0);
  console.log(`[wip] ${cells.length} cells -> ${placed} on the hull (${field[1]?.['cells'].length ?? 0} bars)`);
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
  fog.near = params['size'] * params['fogNear'];
  fog.far = params['size'] * params['fogFar'];
  post['apply'](params);
  if (plates) {
    updateLift(plates, deltaTime, pointer, params);
    for (const blocks of field) updateBlocks(blocks, time, params, surface, plates);
    flow?.['update'](deltaTime, plates, params);
  }
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
