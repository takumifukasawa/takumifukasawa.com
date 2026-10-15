// ?capture: the sketch as a camera, for the poster still and the recording. Never what a visitor gets.
//
// What it changes (main.ts reads `capture` and does the rest):
//   - a fixed frame size (captureWidth x captureHeight) whatever the window is, shown letterboxed
//   - drawn at captureScale times that size, so saving scales it back down: supersampling is the AA
//   - captureMsaa on the composer's target, and no dynamic resolution (the frame must not change tier
//     halfway through a take)
//   - the pointer held at the middle of the frame, so the floor is raised there without a hand on the mouse
//
// Press `s` to save the current frame as a PNG at captureWidth x captureHeight.
// The saved still copies only the WebGL canvas, so the link back to the site (_shell.js) is never in it.
// Add &clean only when recording the whole screen (OBS etc.), where that link would be.
import type { Params } from './params.ts';

export const capture = new URLSearchParams(location.search).has('capture');

// ?capture&time=23:59:00 -- the clock reads that time the moment the page opens, and runs on from there in
// real time. Capture only: a take can then be aimed at a particular moment (a minute or the day rolling
// over) instead of waiting for it. Seconds of offset to add to the wall clock; 0 without the parameter.
export const clockOffset = ((): number => {
  const time = capture ? new URLSearchParams(location.search).get('time') : null;
  const match = time?.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return 0;
  const now = new Date();
  const target = new Date(now);
  target.setHours(Number(match[1]), Number(match[2]), Number(match[3] ?? 0), 0);
  return (target.getTime() - now.getTime()) / 1000;
})();

// The params the frame is drawn with. A copy, never the original: the debug pane's save button writes
// `params` to params.json, and a take must not leave its own settings behind in the file.
export const captureView = (params: Params): Params => ({
  ...params,
  'msaa': params['captureMsaa'],
  'autoQuality': 0,
});

export type Shutter = { 'pending': boolean };

export const createShutter = (): Shutter => {
  const shutter: Shutter = { 'pending': false };
  if (!capture) return shutter;
  window.addEventListener('keydown', (event) => {
    if (event.key === 's' && !event.repeat) shutter['pending'] = true;
  });
  return shutter;
};

// Must run right after the frame is drawn, in the same task: the canvas has no preserveDrawingBuffer, so
// its contents are only defined until the browser composites. createImageBitmap copies the canvas when it
// is called, which is what makes the rest of this safe to be async.
//
// Downscaled by createImageBitmap's resize and shown through a 'bitmaprenderer' context, not drawn onto a
// 2d context: lab:add infers tags from the source, and a 2d context here would tag the work "canvas2d"
// for the sake of a tool that is not part of it.
export const takeShot = (canvas: HTMLCanvasElement, width: number, height: number, name: string) => {
  createImageBitmap(canvas, { 'resizeWidth': width, 'resizeHeight': height, 'resizeQuality': 'high' }).then((bitmap) => {
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    out.getContext('bitmaprenderer')!.transferFromImageBitmap(bitmap);
    out.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      // Local time, not toISOString(): that is UTC, and a file saved at 21:31 named 123106 reads as a
      // different shot.
      const d = new Date();
      const two = (n: number) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
      link.download = `${name}-${stamp}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, 'image/png');
  });
};
