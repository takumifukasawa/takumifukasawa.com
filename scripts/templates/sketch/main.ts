// __SLUG__ — __TITLE__
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - Never use absolute paths starting with `/`. The build output may be moved to another directory.
//   Use relative paths, `new URL('./x.png', import.meta.url)`, or `import.meta.env.BASE_URL`.
// - Shaders: `import frag from './frag.glsl?raw'` (no plugin needed).
// - Debug UI (Tweakpane): do not show it when `?clean` is present (for recording).
//   const clean = new URLSearchParams(location.search).has('clean');
// - No classes: plain state objects + functions, so unused code can be tree-shaken (docs/coding.md).
// - Import libraries per sketch. Do not put shared code in lab/core/ until it has been written 3 times (lab/core/AGENTS.md).
//
// Loop (same structure as takumifukasawa/html-game-template):
// - fixedUpdate: fixed 60 Hz step (time/timeAccumulator.ts). Simulation goes here; independent of the display refresh rate.
// - update / render: once per frame, capped at 60 fps (time/timeSkipper.ts). Matches the 60 fps recording default.

import { createTimeAccumulator, execTimeAccumulator, startTimeAccumulator } from './time/timeAccumulator.ts';
import { createTimeSkipper, execTimeSkipper, startTimeSkipper } from './time/timeSkipper.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const ctx = canvas.getContext('2d')!;
const ratio = Math.min(window.devicePixelRatio, 1.5);

const setSize = () => {
  canvas.width = Math.max(1, Math.floor(window.innerWidth * ratio));
  canvas.height = Math.max(1, Math.floor(window.innerHeight * ratio));
};

const fixedUpdate = (_time: number, _deltaTime: number) => {};

const update = (_time: number, _deltaTime: number) => {};

const render = (time: number, _deltaTime: number) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(
    canvas.width / 2 + Math.cos(time) * canvas.width * 0.25 - 4,
    canvas.height / 2 + Math.sin(time) * canvas.height * 0.25 - 4,
    8,
    8,
  );
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
