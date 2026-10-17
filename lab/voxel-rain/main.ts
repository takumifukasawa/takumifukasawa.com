// voxel rain
//
// A box of voxel cells, empty but for its grid points. Rain falls down the columns, lighting each cell it
// passes for a moment; where it reaches the floor it pushes a 2D wave, and the floor cells glow as high as
// the wave stands there, so the rings spread and run through each other. A click or tap drops a heavy one, and
// dragging drops a line of lighter ones along the path.
//
//   world.ts    the floor's wave: the only state on a grid
//   rain.ts     the drops
//   sparks.ts   the sparks where a click or drag drop appears
//   controls.ts the few knobs visitors get (debug.ts has them all, behind ?debug)
//   voxels.ts   the lit cells, as boxes (voxel.*.glsl): the floor by its wave, the drops by their trails
//   lattice.ts  the grid points
// Everything else is plumbing: camera framing, bloom, debug pane, capture.
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - No absolute paths starting with `/`; the build output may be moved.
// - Debug UI is off by default and shown only with `?debug` (see debug.ts).
// - No classes: plain state objects + functions, so unused code is tree-shaken (docs/coding.md).
// - fixedUpdate: fixed 60 Hz (time/timeAccumulator.ts). update / render: capped at 60 fps (time/timeSkipper.ts).

import * as THREE from 'three';
import { capture, captureView, createShutter, takeShot } from './capture.ts';
import { createControls } from './controls.ts';
import { createDebug, type Monitor } from './debug.ts';
import { createLattice } from './lattice.ts';
import { loadParams } from './params.ts';
import { createPost } from './post.ts';
import { createQuality } from './quality.ts';
import { createRain, drop, stepRain, type Column } from './rain.ts';
import { createSparks } from './sparks.ts';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';
import { createVoxels } from './voxels.ts';
import { createWorld, stepWorld } from './world.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
if (capture) canvas.style.objectFit = 'contain';
const params = loadParams();

// antialias off: everything goes through EffectComposer, the canvas only receives the final quad (post.ts).
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color();
// The same fog for the grid points (PointsMaterial reads scene.fog) and the voxels (voxel.frag.glsl).
const fog = new THREE.Fog(0x000000, 0, 1);
scene.fog = fog;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);

// The world is built on the first frame, once the screen's size is known: its floor is sized to this screen.
const rain = createRain();
const sparks = createSparks();
scene.add(sparks.object);
let built = false;
let world = createWorld(1, 1, 1);
let voxels = createVoxels(world);
let lattice = createLattice(1, 1, 1, 1);

const post = createPost(renderer, scene, camera, params);
const quality = createQuality();
const monitor: Monitor = { drops: 0, voxels: 0, floor: '' };
const debug = createDebug(params, quality, monitor);
createControls(params);
const shutter = createShutter();
if (capture) {
  (window as Window & { voxelRain?: object }).voxelRain = {
    params,
    drop: (x: number, y: number, force?: number) => shutter.drops.push({ x, y, force }),
  };
}

type Frame = { width: number; height: number; pixelRatio: number; bloomScale: number };

const frameFor = (tier: { pixel: number; bloom: number }): Frame =>
  capture
    ? {
        width: params.captureWidth,
        height: params.captureHeight,
        pixelRatio: params.captureScale,
        // Against the capture frame, not the supersampled one, so the bloom spreads as it does on screen.
        bloomScale: params.captureBloomScale * params.bloomScale / params.captureScale,
      }
    : {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: Math.min(window.devicePixelRatio, params.pixelRatio * tier.pixel),
        bloomScale: params.bloomScale * tier.bloom,
      };

let applied = frameFor({ pixel: 1, bloom: 1 });

const setSize = () => {
  if (!capture) applied = { ...applied, width: window.innerWidth, height: window.innerHeight };
  renderer.setPixelRatio(applied.pixelRatio);
  camera.aspect = applied.width / applied.height;
  camera.updateProjectionMatrix();
  renderer.setSize(applied.width, applied.height, false);
  post.setSize(applied.width, applied.height, applied.bloomScale);
};

const DEG = Math.PI / 180;

const raycaster = new THREE.Raycaster();
const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorTop = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
const ndc = new THREE.Vector2();

// The column whose floor cell is under a random point of the screen. A point that misses the floor (sky, when
// the camera looks up) is drawn again, a few times, so the rain keeps its rate however much floor is on screen.
const screenColumn = (): Column => {
  for (let tries = 0; tries < 8; tries++) {
    raycaster.setFromCamera(ndc.set(Math.random() * 2 - 1, Math.random() * 2 - 1), camera);
    if (!raycaster.ray.intersectPlane(floorTop, hit)) continue;
    const x = Math.floor(hit.x + world.nx / 2);
    const z = Math.floor(hit.z + world.nz / 2);
    if (x >= 0 && z >= 0 && x < world.nx && z < world.nz) return { x, z };
  }
  return null;
};
const hit = new THREE.Vector3();
// Click and drag drops start pointerHeight cells up, right under the pointer: the pointer's ray is met with the
// level plane at that height, not with the floor, so on screen the drop appears where the pointer is and falls
// from there. Returns that point in floor cells (0..nx, 0..nz), or null if the ray misses the plane.
const pointerHeight = () => Math.min(world.h, params.pointerHeight);
const pointerAt = (event: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, camera);
  pointerPlane.constant = -pointerHeight();
  if (!raycaster.ray.intersectPlane(pointerPlane, hit)) return null;
  return { x: hit.x + world.nx / 2, z: hit.z + world.nz / 2 };
};

const dropAt = (x: number, z: number, force: number) => {
  const i = Math.floor(x);
  const j = Math.floor(z);
  if (i < 0 || j < 0 || i >= world.nx || j >= world.nz) return;
  const y = pointerHeight();
  drop(rain, i, j, y, force);
  // Not in ?capture: there a click stages the still, and the sparks would only say someone clicked.
  if (!capture) sparks.emit(i - world.nx / 2 + 0.5, y, j - world.nz / 2 + 0.5, params);
};

// A press drops a heavy drop under the pointer. Dragging then drops lighter ones along the path, one every
// dragSpacing cells covered on that plane: the path is walked in those steps, so a fast drag spaces them as evenly as
// a slow one. Each touch keeps its own path.
const drags = new Map<number, { x: number; z: number; carry: number }>();
canvas.addEventListener('pointerdown', (event) => {
  const p = pointerAt(event);
  if (!p) return;
  canvas.setPointerCapture(event.pointerId);
  drags.set(event.pointerId, { x: p.x, z: p.z, carry: 0 });
  dropAt(p.x, p.z, params.tapImpulse);
});
canvas.addEventListener('pointermove', (event) => {
  const drag = drags.get(event.pointerId);
  const p = drag && pointerAt(event);
  if (!drag || !p) return;
  const dx = p.x - drag.x;
  const dz = p.z - drag.z;
  const length = Math.hypot(dx, dz);
  const spacing = Math.max(0.5, params.dragSpacing);
  // Distance along this segment to the next drop.
  let along = spacing - drag.carry;
  while (along <= length) {
    dropAt(drag.x + (dx * along) / length, drag.z + (dz * along) / length, params.dragImpulse);
    along += spacing;
  }
  drag.carry = length - (along - spacing);
  drag.x = p.x;
  drag.z = p.z;
});
const endDrag = (event: PointerEvent) => drags.delete(event.pointerId);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const fixedUpdate = (_time: number, deltaTime: number) => {
  // ?capture: staged drops, each down the column under a point of the frame (capture.ts).
  for (const staged of shutter.drops.splice(0)) {
    raycaster.setFromCamera(ndc.set(staged.x, staged.y), camera);
    if (!raycaster.ray.intersectPlane(floorTop, hit)) continue;
    const x = Math.floor(hit.x + world.nx / 2);
    const z = Math.floor(hit.z + world.nz / 2);
    if (x >= 0 && z >= 0 && x < world.nx && z < world.nz) drop(rain, x, z, world.h, staged.force ?? params.tapImpulse);
  }
  stepRain(rain, world, deltaTime, params, screenColumn);
  sparks.step(deltaTime);
  stepWorld(world, params);
};

const target = new THREE.Vector3();
const ray = new THREE.Vector3();
// A floor this many cells on a side is already far more than any screen shows; past it only the wave
// (world.ts) and the scan over the floor (voxels.ts) grow.
const MAX_SIDE = 512;
// A corner ray that meets the floor only very far off (or never, at or above the horizon) is cut where the fog
// has swallowed everything (fogFar): the floor need not reach further than anyone can see.
// Each end of the camera's sway in pitch and yaw, by each corner of the screen.
const SWAY_CORNERS = [-1, 1].flatMap((p) =>
  [-1, 1].flatMap((y) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => [p, y, sx!, sy!] as const)),
);

// How many cells the screen's shorter side spans at the target: the voxels' size on screen. Set by build() so
// the floor comes to floorCells cells whatever the screen's shape; a resize keeps it, and the floor's margin
// covers what a slightly bigger window shows.
let cellsShort = 1;

// Down onto the floor from above (camPitch), or up at it from below (camPitchBelow): camView picks.
const basePitch = () => (params.camView === 1 ? params.camPitchBelow : params.camPitch);
let builtView = -1;

// The camera circles a target above the floor's centre, camLift camera distances up (0 = on the floor). A negative
// pitch puts it below the target looking up: with no lift that is under the floor, with some lift it is just
// above the floor, looking up into the rain.
const placeCamera = (pitch: number, yaw: number) => {
  const distance = cellsShort / (2 * Math.tan((camera.fov * DEG) / 2) * Math.min(1, camera.aspect));
  target.y = 1 + params.camLift * distance;
  camera.position.set(
    target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    target.y + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return distance;
};

// Size the floor to cover this screen: cast a ray from each corner of the screen to the floor's top (down onto it,
// or up onto its underside),
// take the rectangle around where they land, and grow it by floorMargin. The target sits on that same plane,
// so the rectangle scales exactly with the camera's distance: measure it once at cellsShort = 1, then pick
// the cellsShort whose rectangle holds floorCells cells. The floor stays centred on the origin; the camera's
// target moves instead, by however far the rectangle's centre is off it. The camera sways (camPitchSwing,
// camYawSwing), so the rays are cast from each end of the sway and the rectangle holds all of them.
const build = () => {
  built = true;
  builtView = params.camView;
  target.set(0, 1, 0);
  cellsShort = 1;
  let distance = 0;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const [pitchEnd, yawEnd, sx, sy] of SWAY_CORNERS) {
    distance = placeCamera(
      (basePitch() + pitchEnd * params.camPitchSwing) * DEG,
      (params.camYaw + yawEnd * params.camYawSwing) * DEG,
    );
    ray.set(sx, sy, 0.5).unproject(camera).sub(camera.position).normalize();
    const reach = params.fogFar * distance;
    // Where the ray meets the floor's plane, if ahead of the camera; a ray that never does is cut at reach.
    const meet = (1 - camera.position.y) / ray.y;
    const t = meet > 0 && Number.isFinite(meet) ? Math.min(meet, reach) : reach;
    const x = camera.position.x + ray.x * t;
    const z = camera.position.z + ray.z * t;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  placeCamera(basePitch() * DEG, params.camYaw * DEG);
  const margin = params.floorMargin;
  // As many cells as floorCells allows, but never so many that a cell at the target is under minCellPx CSS pixels:
  // a phone has fewer pixels for the same floor, so there the voxels stay big and the floor gets fewer cells.
  const shortPx = Math.min(applied.width, applied.height);
  cellsShort = Math.min(
    Math.sqrt(params.floorCells / ((x1 - x0) * (z1 - z0) * margin * margin)),
    shortPx / params.minCellPx,
  );
  // Grown about its centre; past MAX_SIDE (only near the horizon) it is cut on the side away from the camera,
  // where the floor is smallest on screen and the cut shows least.
  const side = (lo: number, hi: number, eye: number) => {
    const centre = ((lo + hi) / 2) * cellsShort;
    const n = Math.ceil((hi - lo) * margin * cellsShort);
    if (n <= MAX_SIDE) return { n, centre };
    const near = eye > centre ? centre + n / 2 : centre - n / 2;
    return { n: MAX_SIDE, centre: eye > centre ? near - MAX_SIDE / 2 : near + MAX_SIDE / 2 };
  };
  const sx = side(x0, x1, camera.position.x * cellsShort);
  const sz = side(z0, z1, camera.position.z * cellsShort);
  const nx = sx.n;
  const nz = sz.n;
  target.set(-sx.centre, 1, -sz.centre);

  scene.remove(voxels.mesh, lattice.object);
  voxels.mesh.geometry.dispose();
  (voxels.mesh.material as THREE.Material).dispose();
  voxels.mesh.dispose();
  lattice.object.geometry.dispose();
  (lattice.object.material as THREE.Material).dispose();
  world = createWorld(nx, Math.round(params.gridY), nz);
  rain.count = 0;
  sparks.clear();
  voxels = createVoxels(world);
  lattice = createLattice(nx, world.h, nz, Math.round(params.latticeStep));
  scene.add(voxels.mesh, lattice.object);
  monitor.floor = `${nx}x${nz} / ${cellsShort.toFixed(1)}`;
};

const update = (time: number, deltaTime: number) => {
  const view = capture ? captureView(params) : params;
  const tier = quality.update(deltaTime, view);
  debug.tick(deltaTime);
  const next = frameFor(tier);
  if (
    next.width !== applied.width ||
    next.height !== applied.height ||
    next.pixelRatio !== applied.pixelRatio ||
    next.bloomScale !== applied.bloomScale
  ) {
    applied = next;
    setSize();
  }

  if (camera.fov !== params.camFov) {
    camera.fov = params.camFov;
    camera.updateProjectionMatrix();
  }
  // Switching between looking down and looking up builds the floor again, for what the new view sees.
  if (!built || params.camView !== builtView) build();
  const pitch =
    (basePitch() + Math.sin((time / params.camPitchPeriod) * Math.PI * 2) * params.camPitchSwing) * DEG;
  const yaw =
    (params.camYaw + Math.sin((time / params.camYawPeriod) * Math.PI * 2) * params.camYawSwing) * DEG;
  const distance = placeCamera(pitch, yaw);
  fog.color.setHex(params.bgColor);
  fog.near = params.fogNear * distance;
  fog.far = params.fogFar * distance;

  renderer.toneMappingExposure = params.exposure;
  (scene.background as THREE.Color).setHex(params.bgColor);
  voxels.update(world, rain, params, fog);
  sparks.update(params);
  lattice.update(params);
  monitor.drops = rain.count;
  monitor.voxels = voxels.mesh.count;
  post.apply(view);
};

const render = (_time: number, _deltaTime: number) => {
  post.composer.render();
  if (shutter.pending) {
    shutter.pending = false;
    takeShot(canvas, applied.width, applied.height, 'voxel-rain');
  }
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

const startTime = getCurrentRealTime();
startTimeAccumulator(fixedTimer, startTime);
startTimeSkipper(frameTimer, startTime);
setSize();
window.addEventListener('resize', setSize);
window.requestAnimationFrame(tick);
