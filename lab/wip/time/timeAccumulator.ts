// Fixed-step timer: calls `callback` at exactly `targetFPS` steps per second, catching up on missed steps
// (up to `maxChaseCount`, beyond that it jumps). Use it for simulation (fixedUpdate).
//
// Adapted from takumifukasawa/html-game-template src/scripts/utilities/TimeAccumulator.ts @ ceba74a,
// rewritten as plain state + functions (no classes) so unused code can be tree-shaken.
// A per-sketch copy on purpose (decision 0001: build outputs are frozen per sketch).

type Callback = (lastTime: number, interval: number) => void;

export type TimeAccumulator = {
  targetFPS: number;
  maxChaseCount: number;
  callback: Callback;
  lastTime: number;
};

export const createTimeAccumulator = (targetFPS: number, callback: Callback, maxChaseCount = 60): TimeAccumulator => ({
  targetFPS,
  maxChaseCount,
  callback,
  lastTime: -Infinity,
});

export const startTimeAccumulator = (accumulator: TimeAccumulator, time: number) => {
  accumulator.lastTime = time;
};

export const execTimeAccumulator = (accumulator: TimeAccumulator, time: number) => {
  const interval = 1 / accumulator.targetFPS;

  if (time - interval >= accumulator.lastTime) {
    const elapsedTime = time - accumulator.lastTime;
    const n = Math.floor(elapsedTime / interval);

    if (n > accumulator.maxChaseCount) {
      console.warn('[execTimeAccumulator] jump frame');
      accumulator.lastTime += interval * n;
      accumulator.callback(accumulator.lastTime, interval);
      return;
    }

    for (let i = 0; i < n; i++) {
      accumulator.lastTime += interval;
      accumulator.callback(accumulator.lastTime, interval);
    }
  }
};
