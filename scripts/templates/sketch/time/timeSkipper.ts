// Frame-rate cap: calls `callback` at most `targetFPS` times per second, skipping frames in between
// (deltaTime covers the skipped time). Use it for update / render.
//
// Adapted from takumifukasawa/html-game-template src/scripts/utilities/TimeSkipper.ts @ ceba74a,
// rewritten as plain state + functions (no classes) so unused code can be tree-shaken.
// A per-sketch copy on purpose (decision 0001: build outputs are frozen per sketch).

type Callback = (lastTime: number, deltaTime: number) => void;

export type TimeSkipper = {
  targetFPS: number;
  callback: Callback;
  lastTime: number;
};

export const createTimeSkipper = (targetFPS: number, callback: Callback): TimeSkipper => ({
  targetFPS,
  callback,
  lastTime: -Infinity,
});

export const startTimeSkipper = (skipper: TimeSkipper, time: number) => {
  skipper.lastTime = time;
};

export const execTimeSkipper = (skipper: TimeSkipper, time: number) => {
  const interval = 1 / skipper.targetFPS;
  if (time - interval >= skipper.lastTime) {
    const elapsedTime = time - skipper.lastTime;
    const n = Math.floor(elapsedTime / interval);
    const deltaTime = interval * n;
    skipper.lastTime += deltaTime;
    skipper.callback(skipper.lastTime, deltaTime);
  }
};
