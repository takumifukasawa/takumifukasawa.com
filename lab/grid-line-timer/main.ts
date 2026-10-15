// grid-line-timer
//
// A digital clock on a grid. Every second, one line per segment that comes on in HH:MM:SS flies in
// from off screen along the grid and lands exactly on the second. Unchanged digits stay still.
//
//   clock.ts   where each lit segment is (7-segment table, the two layouts)
//   route.ts   the path a line takes along the grid to its segment
//   lines.ts   timing per second, and the quads that draw the lines
//   grid.ts    the grid
// Everything else is plumbing: camera framing, bloom, debug pane, capture.
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - No absolute paths starting with `/`; the build output may be moved.
// - Debug UI is off by default and shown only with `?debug` (see debug.ts).
// - No classes: plain state objects + functions, so unused code is tree-shaken (docs/coding.md).
// - fixedUpdate: fixed 60 Hz (time/timeAccumulator.ts). update / render: capped at 60 fps (time/timeSkipper.ts).

import * as THREE from 'three';
import { capture, captureView, createShutter, takeShot } from './capture.ts';
import { pickLayout, type Vec2 } from './clock.ts';
import { createDebug } from './debug.ts';
import { createGrid } from './grid.ts';
import { createLines } from './lines.ts';
import { loadParams } from './params.ts';
import { createPost } from './post.ts';
import { createQuality } from './quality.ts';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
if (capture) canvas.style.objectFit = 'contain';
const params = loadParams();

// antialias off: everything goes through EffectComposer, the canvas only receives the final quad (post.ts).
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color();

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);

const grid = createGrid();
scene.add(grid['object']);
const lines = createLines();
scene.add(lines['mesh']);

const post = createPost(renderer, scene, camera, params);
const quality = createQuality();
const debug = createDebug(params, quality);
const shutter = createShutter();

type Frame = { 'width': number; 'height': number; 'pixelRatio': number; 'bloomScale': number };

const frameFor = (tier: { 'pixel': number; 'bloom': number }): Frame =>
  capture
    ? {
        'width': params['captureWidth'],
        'height': params['captureHeight'],
        'pixelRatio': params['captureScale'],
        // Against the capture frame, not the supersampled one, so the bloom spreads as it does on screen.
        'bloomScale': params['captureBloomScale'] * params['bloomScale'] / params['captureScale'],
      }
    : {
        'width': window.innerWidth,
        'height': window.innerHeight,
        'pixelRatio': Math.min(window.devicePixelRatio, params['pixelRatio'] * tier['pixel']),
        'bloomScale': params['bloomScale'] * tier['bloom'],
      };

let applied = frameFor({ 'pixel': 1, 'bloom': 1 });

const setSize = () => {
  if (!capture) applied = { ...applied, 'width': window.innerWidth, 'height': window.innerHeight };
  renderer.setPixelRatio(applied['pixelRatio']);
  camera.aspect = applied['width'] / applied['height'];
  camera.updateProjectionMatrix();
  renderer.setSize(applied['width'], applied['height'], false);
  post['setSize'](applied['width'], applied['height'], applied['bloomScale']);
};

const DEG = Math.PI / 180;
const target = new THREE.Vector3();
// Wall-clock seconds. The lines land on real second boundaries, so this has to be the epoch, not page time.
const wallTime = () => (performance.timeOrigin + performance.now()) / 1000;

const fixedUpdate = (_time: number, _deltaTime: number) => {};

const update = (time: number, deltaTime: number) => {
  const view = capture ? captureView(params) : params;
  const tier = quality['update'](deltaTime, view);
  debug['tick'](deltaTime);
  const next = frameFor(tier);
  if (
    next['width'] !== applied['width'] ||
    next['height'] !== applied['height'] ||
    next['pixelRatio'] !== applied['pixelRatio'] ||
    next['bloomScale'] !== applied['bloomScale']
  ) {
    applied = next;
    setSize();
  }

  // Frame the clock: whichever of its width and height is tighter against the screen fills camFit of it.
  const aspect = camera.aspect;
  const layout = pickLayout(params['layout'], aspect);
  const center: Vec2 = [(layout['min'][0] + layout['max'][0]) / 2, (layout['min'][1] + layout['max'][1]) / 2];
  const halfW = (layout['max'][0] - layout['min'][0]) / 2;
  const halfH = (layout['max'][1] - layout['min'][1]) / 2;
  if (camera.fov !== params['camFov']) {
    camera.fov = params['camFov'];
    camera.updateProjectionMatrix();
  }
  const tan = Math.tan((params['camFov'] * DEG) / 2);
  const fit = params['camFit'];
  const distance = Math.max(halfH / (tan * fit), halfW / (tan * aspect * fit));
  const pitch = (params['camPitch'] + Math.sin((time / params['camPitchPeriod']) * Math.PI * 2) * params['camPitchSwing']) * DEG;
  const yaw = (params['camYaw'] + Math.sin((time / params['camPeriod']) * Math.PI * 2) * params['camSwing']) * DEG;
  target.set(center[0], center[1], 0);
  camera.position.set(
    center[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
    center[1] + Math.sin(pitch) * distance,
    Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  camera.lookAt(target);

  // Where the lines start: past the edge of what the camera sees of the plane (ignoring the tilt, which
  // spawnMargin covers).
  const viewHalfH = distance * tan;
  const bound: Vec2 = [viewHalfH * aspect + params['spawnMargin'], viewHalfH + params['spawnMargin']];

  renderer.toneMappingExposure = params['exposure'];
  (scene.background as THREE.Color).setHex(params['bgColor']);
  const now = wallTime();
  grid['update'](now, layout, center, params);
  lines['update'](now, layout, bound, params);
  post['apply'](view);
};

const render = (_time: number, _deltaTime: number) => {
  post['composer'].render();
  if (shutter['pending']) {
    shutter['pending'] = false;
    takeShot(canvas, applied['width'], applied['height'], 'grid-line-timer');
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
