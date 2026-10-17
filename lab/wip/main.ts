// wip — Voxel waves
//
// A cube of voxel cells. A tap knocks the cell under it, and the wave runs through the solid cells, bounces off
// the walls, runs through other waves, and may leave color behind. Dragging turns the cube.
// Plan, division of labor and decisions: docs/plans/active/wip.md.
//
//   shape.ts    which cells are solid (human)
//   cells.ts    the solid mask and the surface cells
//   state.ts    the state of every cell on the GPU, stepped by step.wgsl (human)
//   voxels.ts   the surface cells as instanced boxes, colored by color.wgsl (human)
//   pointer.ts  tap vs drag, and the drag's turn
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - No absolute paths starting with `/`; the build output may be moved.
// - Debug UI is off by default and shown only with `?debug`.
// - Capture (`?capture`): lab/core/capture.ts (import from '../core/capture.ts').
// - No classes: plain state objects + functions, so unused code is tree-shaken (docs/coding.md).
// - Only 'three/webgpu' and 'three/tsl'. Importing 'three' too would bundle the WebGL renderer as well.
// - fixedUpdate: fixed 60 Hz (time/timeAccumulator.ts). update / render: capped at 60 fps (time/timeSkipper.ts).

import {
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Raycaster,
  Renderer,
  Scene,
  StandardNodeLibrary,
  Vector2,
  WebGPUBackend,
} from 'three/webgpu';
import { createCells } from './cells.ts';
import { attachPointer } from './pointer.ts';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';
import { createState } from './state.ts';
import { createVoxels } from './voxels.ts';

// Provisional (plan: 未確定事項).
const GRID = 64;

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;

// Shown in place of the sketch when WebGPU cannot start. Text on the page, not the console: the build drops
// console.*, and console.error would fail `artifacts run`.
const fail = () => {
  const message = document.createElement('p');
  message.textContent = 'このブラウザでは WebGPU を使えないため、表示できません。';
  message.style.cssText =
    'position:fixed;inset:0;margin:auto;height:fit-content;color:#888;font:14px/1.6 sans-serif;text-align:center;padding:0 16px;';
  document.body.append(message);
  canvas.remove();
};

// Renderer + WebGPUBackend, not WebGPURenderer: that one falls back to WebGL2 without WebGPU, warning only,
// and the WGSL would then break instead of reaching fail() (decision log of the plan).
// The library is what WebGPURenderer sets on top of Renderer: without it, lights and materials have no nodes.
const renderer = new Renderer(new WebGPUBackend({ canvas }));
renderer.library = new StandardNodeLibrary();

const start = () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 1000);

  const cells = createCells(GRID);
  const shape = new Group();
  // Provisional: a corner toward the camera, so it reads as a cube before anyone drags it.
  shape.rotation.set(Math.PI / 6, -Math.PI / 4, 0);
  const state = createState(cells);
  const voxels = createVoxels(cells, state);
  shape.add(voxels);
  scene.add(shape);

  // Placeholder light for the placeholder look (voxels.ts).
  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(0.5, 1, 0.8);
  scene.add(sun);

  const setSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // The whole cube in view however it is turned: its circumscribed sphere fits the narrower field of view.
    const radius = (GRID * Math.sqrt(3)) / 2;
    const vertical = (camera.fov * Math.PI) / 360;
    const narrower = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
    camera.position.set(0, 0, (radius / Math.sin(narrower)) * 1.05);
    camera.near = camera.position.z - radius * 1.1;
    camera.far = camera.position.z + radius * 1.1;
    camera.updateProjectionMatrix();
  };

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  attachPointer(canvas, shape, (x, y) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(voxels)[0];
    if (hit?.instanceId === undefined) return;
    state.knock(cells.surface[hit.instanceId]!);
  });

  const fixedUpdate = (_time: number, _deltaTime: number) => state.step(renderer);
  const update = (_time: number, _deltaTime: number) => {};
  const render = (_time: number, _deltaTime: number) => renderer.render(scene, camera);

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
};

renderer.init().then(start, fail);
