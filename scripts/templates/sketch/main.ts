// __SLUG__ — __TITLE__
//
// Conventions (docs/decisions/0004-lab-shell.md):
// - Never use absolute paths starting with `/`. The build output may be moved to another directory.
//   Use relative paths, `new URL('./x.png', import.meta.url)`, or `import.meta.env.BASE_URL`.
// - Shaders: `import frag from './frag.glsl?raw'` (no plugin needed).
// - Debug UI (Tweakpane): do not show it when `?clean` is present (for recording).
//   const clean = new URLSearchParams(location.search).has('clean');
// - Import libraries per sketch. Do not put shared code in lab/core/ until it has been written 3 times (lab/core/AGENTS.md).

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const ctx = canvas.getContext('2d')!;

const resize = () => {
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
};
window.addEventListener('resize', resize);
resize();

const loop = (now: number) => {
  const t = now / 1000;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(
    canvas.width / 2 + Math.cos(t) * canvas.width * 0.25 - 4,
    canvas.height / 2 + Math.sin(t) * canvas.height * 0.25 - 4,
    8,
    8,
  );
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
