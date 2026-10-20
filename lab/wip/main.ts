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
//   post.ts     bloom and chromatic aberration
//   params.ts   the knobs (values in params.json), as uniforms; debug.ts shows them with ?debug
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - No absolute paths starting with `/`; the build output may be moved.
// - Debug UI is off by default and shown only with `?debug`.
// - Capture (`?capture`): lab/core/capture.ts (import from '../core/capture.ts').
// - No classes: plain state objects + functions, so unused code is tree-shaken (docs/coding.md).
// - Only 'three/webgpu' and 'three/tsl' in our own code. Importing 'three' too would bundle the WebGL renderer as well.
//   An example module that imports 'three' for core classes is fine (RoundedBoxGeometry in voxels.ts: they resolve
//   to the same three.core.js; checked by bundle size, 2026-10-20).
// - fixedUpdate: fixed 60 Hz (time/timeAccumulator.ts). update / render: capped at 60 fps (time/timeSkipper.ts).

import {
  AmbientLight,
  Color,
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
import { createDebug } from './debug.ts';
import { createUniforms, loadParams } from './params.ts';
import { attachPointer } from './pointer.ts';
import { createPost } from './post.ts';
import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';
import { createState } from './state.ts';
import { createVoxels } from './voxels.ts';

// Provisional (plan: 未確定事項). Dev only: ?grid=32 overrides it, to compare sizes while deciding.
// Remove the override once the size is settled.
const gridOverride = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('grid')) : 0;
const GRID = Number.isInteger(gridOverride) && gridOverride >= 2 && gridOverride <= 128 ? gridOverride : 64;

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
  const params = loadParams();
  const uniforms = createUniforms(params);
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 1000);

  const cells = createCells(GRID);
  const shape = new Group();
  // Provisional: a corner toward the camera, so it reads as a cube before anyone drags it.
  shape.rotation.set(Math.PI / 6, -Math.PI / 4, 0);
  const state = createState(cells, uniforms);
  const voxels = createVoxels(cells, state, uniforms, params);
  createDebug(params, { reset: () => state.reset(renderer) });
  shape.add(voxels.mesh);
  scene.add(shape);

  // Lights and background from the knobs (params.ts, light / colour folders), set again every frame.
  // The sun points at the origin from (sunX, sunY, sunZ); only the direction matters.
  const ambient = new AmbientLight();
  const sun = new DirectionalLight();
  scene.add(ambient, sun);
  scene.background = new Color();
  const applyLook = () => {
    ambient.color.setHex(params.ambientColor);
    ambient.intensity = params.ambientIntensity;
    sun.color.setHex(params.sunColor);
    sun.intensity = params.sunIntensity;
    sun.position.set(params.sunX, params.sunY, params.sunZ);
    (scene.background as Color).setHex(params.bgColor);
  };
  applyLook();

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
    const hit = raycaster.intersectObject(voxels.hit)[0];
    if (hit?.instanceId === undefined) return;
    state.knock(cells.surface[hit.instanceId]!);
  });

  const fixedUpdate = (_time: number, _deltaTime: number) => {
    for (let i = 0; i < params.stepsPerFrame; i++) state.step(renderer);
  };
  const update = (_time: number, _deltaTime: number) => {
    applyLook();
    voxels.update();
  };
  const post = createPost(renderer, scene, camera, uniforms);
  const render = (_time: number, _deltaTime: number) => post.render();

  const fixedTimer = createTimeAccumulator(60, fixedUpdate);
  const frameTimer = createTimeSkipper(60, (time, deltaTime) => {
    update(time, deltaTime);
    render(time, deltaTime);
  });
  const getCurrentRealTime = () => performance.now() / 1000;
  const tick = () => {
    const time = getCurrentRealTime();
    uniforms.sync();
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
