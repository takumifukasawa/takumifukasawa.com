// Tweakpane, built from the schema in params.ts so the knobs are declared in exactly one place.
// Never shown when ?clean is present (that is the recording URL; decision 0004).
import { Pane } from 'tweakpane';
import { LIVE_KEYS, SCHEMA, type ParamKey, type Params } from './params.ts';

export const createDebug = (params: Params, onRebuild: () => void) => {
  if (new URLSearchParams(location.search).has('clean')) return;

  const pane = new Pane({ title: 'greeble' });
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

  // Dev only. There is no endpoint in the built sketch, and the published build has no reason to write
  // anything -- its values are already baked in from params.json at build time.
  if (!import.meta.env.DEV) return;

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
};
