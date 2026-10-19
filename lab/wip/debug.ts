// Tweakpane, built from the schema in params.ts so the knobs are declared in exactly one place.
// Off by default: shown only with ?debug in the URL (lab/voxel-rain/debug.ts has the reasons).
// Dev only: a button that writes the current values to params.json (vite.config.ts).
import { Pane } from 'tweakpane';
import { SCHEMA, type ParamKey, type Params } from './params.ts';

// `reset`: the state back to rest (state.ts).
export const createDebug = (params: Params, actions: { reset: () => void }) => {
  if (!new URLSearchParams(location.search).has('debug')) return;

  const pane = new Pane({ title: 'wip' });
  const folders = new Map<string, ReturnType<Pane['addFolder']>>();
  for (const key of Object.keys(SCHEMA) as ParamKey[]) {
    const spec = SCHEMA[key];
    let folder = folders.get(spec.folder);
    if (!folder) {
      folder = pane.addFolder({ title: spec.folder });
      folders.set(spec.folder, folder);
    }
    folder.addBinding(params, key, { min: spec.min, max: spec.max, step: spec.step });
  }

  pane.addButton({ title: 'reset state' }).on('click', actions.reset);

  if (!import.meta.env.DEV) return;

  const state = { saved: true };
  const status = pane.addBinding(state, 'saved', { readonly: true });
  for (const folder of folders.values()) folder.on('change', () => (state.saved = false));

  pane.addButton({ title: 'save to params.json' }).on('click', async () => {
    const res = await fetch('/__params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      console.error('[wip] save failed:', res.status, await res.text());
      return;
    }
    // Writing params.json is a source change, so Vite reloads the page: what comes back is read from the file.
    state.saved = true;
    status.refresh();
  });
};
