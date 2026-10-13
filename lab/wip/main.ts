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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import envUrl from './env.hdr?url';
import { applyMaterials, createField, disposeField, updateBlocks, type Blocks } from './blocks.ts';
import { createFlow, type Flow } from './flow.ts';
import { collectPlates, updateLift, type Plates } from './lift.ts';
import { createPointer } from './pointer.ts';
import { createDebug } from './debug.ts';
import { loadParams } from './params.ts';
import { createPost } from './post.ts';
import { createQuality } from './quality.ts';
import { subdivide } from './subdivide.ts';
import { createPlaneSurface } from './surface.ts';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
// Values come from params.json, never from code (the debug pane's save button writes that file).
const params = loadParams();

// antialias: false on purpose. Everything is drawn through EffectComposer, which renders into its own
// targets -- the canvas MSAA never participates and is pure cost on a phone
// (gamedev:mobile-audio-render). Post-process aliasing is handled by the passes, not by the canvas.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in three r186
// Redrawn only when the field actually moves; see the note in update(). three's default is to re-render
// the shadow map every frame, which for a field that is standing still is a whole second geometry pass
// producing a pixel-identical texture.
renderer.shadowMap.autoUpdate = false;
// Filmic, not linear: the emissive bars run well past 1.0 and linear clipping turns them into flat orange
// blobs. OutputPass at the end of the composer is what actually applies this.
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
// Colours, intensities and fog distances are all written per frame from params (every one of them a
// LIVE_KEY), so the look can be tuned by eye from the pane and saved. Nothing about the look is decided in
// this file -- these two only need to be the right KIND of object for the per-frame writes to land on.
scene.background = new THREE.Color();
scene.fog = new THREE.Fog(0, 1, 2);

// Metal with nothing to reflect renders black, so a metallic material needs an environment before it is a
// material at all -- and with the floor going metallic, the environment IS the look.
//
// Two stages, because the HDRI arrives over the network: RoomEnvironment is three's procedural stand-in
// and it is ready synchronously, so the first frames are lit rather than black, and the real map replaces
// it when it lands. env.hdr is a 512-wide equirect built by `node scripts/prep-hdri.ts` from a Poly Haven
// source (CC0) -- 512 because PMREMGenerator resamples whatever it is given down to a 256-per-face cube,
// so a 1k source is 1.2 MB spent on data that is filtered away before it reaches a pixel.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
new HDRLoader().load(envUrl, (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const previous = scene.environment;
  scene.environment = pmrem.fromEquirectangular(texture).texture;
  previous?.dispose();
  texture.dispose();
});

// Far enough back that the whole body is in frame: greeble only reads as greeble at the density scale,
// and from close up the identical geometry reads as architecture.
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200); // fov is set per frame from params

// No OrbitControls. Touch has no hover, so on a phone every interaction is a drag: with the camera on one
// finger, raising a plate and spinning the scene become the same gesture and neither can be aimed. The
// camera belongs to the sketch; the pointer belongs to the viewer.
//
// It still swings by a few degrees. A full revolution would read as a turntable, but a little parallax is
// what makes a field of boxes look like it has depth.
const orbit = { 'radius': 1, 'height': 1, 'azimuth': 0 };
const target = new THREE.Vector3();

const key = new THREE.DirectionalLight(0xffffff, 1);
key.castShadow = true;
scene.add(key);

// Warm rim from the far side. Without it every block reads as one flat tone from the key light and the
// field loses its edges; this is also where the reference's red/orange against teal/white comes from.
const rim = new THREE.DirectionalLight(0xffffff, 1);
scene.add(rim);

const ambient = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
scene.add(ambient);

const groundMaterial = new THREE.MeshStandardMaterial();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const surface = createPlaneSurface(params);
const pointer = createPointer(canvas, camera);

let field: Blocks[] = [];
let plates: Plates | undefined;
let flow: Flow | undefined;
// Set by rebuild, cleared by the first update that follows it: new instances have no matrices yet and the
// shadow map still holds the old field.
let geometryDirty = true;
let appliedLiftHeight = Number.NaN;

// Called at startup and whenever a knob outside LIVE_KEYS changes. The footprints, heights, per-cell delays
// and materials are all computed here, once -- never per frame.
const rebuild = () => {
  geometryDirty = true;
  for (const blocks of field) scene.remove(blocks['mesh']);
  disposeField(field);

  // Back to the subdivision domain as the world: the surface IS the ground now.
  const size = params['size'];

  ground.scale.set(size * 4, size * 4, 1);
  ground.position.y = 0;
  target.set(0, 0, 0);

  // The floor has to run off every edge of the frame: a field that ends inside it reads as an object in a
  // void, and leaves the eye an empty background to settle on.
  //
  // Enlarging the field does NOT fix that. Distance and height are both multiples of size, so the whole
  // composition is scale-invariant -- only the RATIOS and the field of view decide whether the far edge
  // lands inside the frame. The condition is
  //     height / tan(elevation - fov/2) - distance  <=  size / 2
  // which at camDistance 0.62, camHeight 0.55, camFov 26 comes out at 0.39 against a limit of 0.5.
  orbit['radius'] = size * params['camDistance'];
  orbit['height'] = size * params['camHeight'];
  orbit['azimuth'] = Math.PI * 0.25;

  // Resizing a shadow map means reallocating its render target, so it belongs here rather than per frame.
  const shadowSize = 2 ** params['shadowBits'];
  if (key.shadow.mapSize.x !== shadowSize) {
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.map?.dispose();
    key.shadow.map = null;
  }
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
const quality = createQuality();
const debug = createDebug(params, quality, rebuild);

// Both are the saved knob scaled down by whatever tier quality.ts has settled on. The pixel ratio is then
// capped against the device: drawing more pixels than the screen has is pure cost.
let appliedPixelRatio = Math.min(window.devicePixelRatio, params['pixelRatio']);
let appliedBloomScale = params['bloomScale'];

const setSize = () => {
  renderer.setPixelRatio(appliedPixelRatio);
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  post['setSize'](w, h, appliedBloomScale);
};

const fixedUpdate = (_time: number, _deltaTime: number) => {};

const update = (time: number, deltaTime: number) => {
  // The tier for this frame. Reading the frame time here rather than in the pane is deliberate: the
  // sketch has to respond to it whether or not the debug UI exists (?clean has no pane at all).
  const tier = quality['update'](deltaTime, params);
  debug['tick'](deltaTime);
  // Changing either of these reallocates render targets, so only on an actual change.
  const pixelRatio = Math.min(window.devicePixelRatio, params['pixelRatio'] * tier['pixel']);
  const bloomScale = params['bloomScale'] * tier['bloom'];
  if (pixelRatio !== appliedPixelRatio || bloomScale !== appliedBloomScale) {
    appliedPixelRatio = pixelRatio;
    appliedBloomScale = bloomScale;
    setSize();
  }
  // Its own period, not loopPeriod. They were the same number back when the whole piece was one cycle;
  // with autoGrow off, loopPeriod drives nothing the eye can see and the camera should not inherit it.
  if (camera.fov !== params['camFov']) {
    camera.fov = params['camFov'];
    camera.updateProjectionMatrix();
  }
  const swing = Math.sin((time / params['camPeriod']) * Math.PI * 2) * params['camSwing'];
  const azimuth = orbit['azimuth'] + swing;
  camera.position.set(Math.cos(azimuth) * orbit['radius'], orbit['height'], Math.sin(azimuth) * orbit['radius']);
  camera.lookAt(target);

  renderer.toneMappingExposure = params['exposure'];
  key.intensity = params['keyLight'];
  key.color.setHex(params['keyColor']);
  key.shadow.intensity = params['shadowStrength'];
  rim.intensity = params['rimLight'];
  rim.color.setHex(params['rimColor']);
  ambient.intensity = params['ambient'];
  ambient.color.setHex(params['skyColor']);
  ambient.groundColor.setHex(params['earthColor']);
  // Its own knob, no longer a fraction of `ambient`. With a real HDRI this is the reflection strength,
  // which is a different decision from how much flat fill the scene gets.
  scene.environmentIntensity = params['envIntensity'];
  groundMaterial.color.setHex(params['groundColor']);
  groundMaterial.roughness = params['groundRough'];
  groundMaterial.metalness = params['groundMetal'];
  applyMaterials(field, params);
  // The fog must be the background colour, or the field dissolves into a band of the wrong hue at the
  // horizon -- so one knob writes both.
  (scene.background as THREE.Color).setHex(params['bgColor']);
  const fog = scene.fog as THREE.Fog;
  fog.color.setHex(params['bgColor']);
  fog.near = params['size'] * params['fogNear'];
  fog.far = params['size'] * params['fogFar'];
  post['apply'](params, tier);
  if (plates) {
    const moved = updateLift(plates, deltaTime, pointer, params);
    // With autoGrow off, growth() is the constant 1 and createPlaneSurface ignores time -- so once the
    // lifts have settled the field is not merely slow-moving, it is IDENTICAL from frame to frame. Both
    // of the things it feeds can then be skipped outright:
    //
    //   - the instance matrices (17k boxes of trigonometry-free but not free arithmetic)
    //   - the SHADOW MAP, which is a second full pass over every one of those boxes
    //
    // The camera moving does not invalidate either: the instances are in world space and a directional
    // light's shadow map does not depend on the viewer. This is the whole reason the piece can afford
    // this many blocks on a phone.
    //
    // liftHeight is live and scales a settled lift, so a change to it has to count as movement even when
    // nothing is easing. Anything else that moves geometry is a rebuild, which sets the flag directly.
    if (moved > 1e-5 || params['autoGrow'] > 0 || params['liftHeight'] !== appliedLiftHeight || geometryDirty) {
      appliedLiftHeight = params['liftHeight'];
      geometryDirty = false;
      for (const blocks of field) updateBlocks(blocks, time, params, surface, plates);
      renderer.shadowMap.needsUpdate = true;
    }
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
