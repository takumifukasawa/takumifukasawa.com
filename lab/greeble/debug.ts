// Tweakpane, built from the schema in params.ts so the knobs are declared in exactly one place.
// Never shown when ?clean is present (that is the recording URL; decision 0004).
import { Pane } from 'tweakpane';
import { LIVE_KEYS, SCHEMA, type ParamKey, type Params } from './params.ts';

export type Debug = { 'tick': (deltaTime: number) => void };

const NOOP: Debug = { 'tick': () => {} };

export const createDebug = (params: Params, onRebuild: () => void): Debug => {
  if (new URLSearchParams(location.search).has('clean')) return NOOP;

  const pane = new Pane({ title: 'greeble' });

  // Frame time first, and expanded. The reason it exists is that "is this too heavy on a phone?" is not a
  // question anyone can answer by looking -- open the sketch on the device with `pnpm dev:lab greeble
  // --https` and read the number. ms is the honest unit: 16.7 is the 60 fps budget, and unlike fps it does
  // not compress the interesting part of the range into a few pixels.
  const perf = { 'ms': 0 };
  const perfFolder = pane.addFolder({ title: 'perf' });
  perfFolder.addBinding(perf, 'ms', { readonly: true, view: 'graph', min: 0, max: 40 });
  perfFolder.addBinding(perf, 'ms', { readonly: true, format: (v: number) => v.toFixed(1) });

  const folders = new Map<string, ReturnType<Pane['addFolder']>>();

  for (const key of Object.keys(SCHEMA) as ParamKey[]) {
    const spec = SCHEMA[key];
    let folder = folders.get(spec['folder']);
    if (!folder) {
      folder = pane.addFolder({ title: spec['folder'] });
      folders.set(spec['folder'], folder);
    }
    const binding = folder.addBinding(params, key, { min: spec['min'], max: spec['max'], step: spec['step'] });
    // Live knobs are read every frame. Everything else feeds data computed once per rebuild, so changing
    // it has to rebuild the field -- on `last` only, or dragging a slider rebuilds on every pixel.
    if (!LIVE_KEYS.includes(key)) {
      binding.on('change', (ev) => {
        if (ev.last) onRebuild();
      });
    }
  }

  // Smoothed, because a raw per-frame number is unreadable: it is the sustained cost that matters, and a
  // single long frame (a GC, the pane redrawing itself) would otherwise look like the sketch is slow.
  const debug: Debug = {
    'tick': (deltaTime) => {
      perf['ms'] += (deltaTime * 1000 - perf['ms']) * 0.1;
    },
  };

  // Dev only. There is no endpoint in the built sketch, and the published build has no reason to write
  // anything -- its values are already baked in from params.json at build time.
  if (!import.meta.env.DEV) return debug;

  const state = { 'saved': true };
  const status = pane.addBinding(state, 'saved', { readonly: true });
  for (const folder of folders.values()) folder.on('change', () => (state['saved'] = false));

  pane.addButton({ title: 'save to params.json' }).on('click', async () => {
    const res = await fetch('/__params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      console.error('[greeble] save failed:', res.status, await res.text());
      return;
    }
    // Writing params.json is a source change, so Vite reloads the page -- which is the confirmation:
    // what comes back is read from the file, not from memory.
    state['saved'] = true;
    status.refresh();
  });

  return debug;
};
