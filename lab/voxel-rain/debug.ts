// Tweakpane, built from the schema in params.ts so the knobs are declared in exactly one place.
// Off by default: it is shown only with ?debug in the URL. The published sketch is what people see,
// and a pane of knobs on top of it is not part of the work -- opt-in means every visitor and every
// recording gets the sketch alone without anyone having to remember a flag. ?clean is therefore no
// longer about the pane; it only hides the site link in _shell.js (decision 0004).
import { Pane } from 'tweakpane';
import { SCHEMA, isColor, toJSON, type ParamKey, type Params, type Spec } from './params.ts';
import type { Quality } from './quality.ts';

export type Debug = { tick: (deltaTime: number) => void };

const NOOP: Debug = { tick: () => {} };

// Live readouts: drops in the air, and lit voxels drawn this frame (the instance count, which is the cost).
export type Monitor = { drops: number; voxels: number; floor: string };

export const createDebug = (params: Params, quality: Quality, monitor: Monitor): Debug => {
  if (!new URLSearchParams(location.search).has('debug')) return NOOP;

  const pane = new Pane({ title: 'voxel-rain' });

  // Frame time first, and expanded. The reason it exists is that "is this too heavy on a phone?" is not a
  // question anyone can answer by looking -- open the sketch on the device with `pnpm dev:lab wip
  // --https` and read the number. ms is the honest unit: 16.7 is the 60 fps budget, and unlike fps it does
  // not compress the interesting part of the range into a few pixels.
  //
  // Read straight off quality.ts rather than smoothed again here. The number the pane shows has to be the
  // same number the dynamic resolution is deciding on, or a tier change looks unexplained.
  const perfFolder = pane.addFolder({ title: 'perf' });
  perfFolder.addBinding(quality, 'ms', { readonly: true, view: 'graph', min: 0, max: 40 });
  perfFolder.addBinding(quality, 'ms', { readonly: true, format: (v: number) => v.toFixed(1) });
  // Which tier it settled on. 0 is the saved params; anything else means the device could not hold them,
  // and that is the single most useful thing to see on a phone.
  perfFolder.addBinding(quality, 'tier', { readonly: true, format: (v: number) => v.toFixed(0) });
  perfFolder.addBinding(monitor, 'drops', { readonly: true, format: (v: number) => v.toFixed(0) });
  perfFolder.addBinding(monitor, 'voxels', { readonly: true, format: (v: number) => v.toFixed(0) });
  perfFolder.addBinding(monitor, 'floor', { readonly: true });

  // Seeded with the folder just built, so the schema's own `perf` knobs (pixelRatio, autoQuality,
  // qualityMs) land next to the frame time they exist to control instead of in a second folder with the
  // same name. It also means perf stays expanded while the rest start collapsed.
  const folders = new Map<string, ReturnType<Pane['addFolder']>>([['perf', perfFolder]]);

  for (const key of Object.keys(SCHEMA) as ParamKey[]) {
    const spec: Spec = SCHEMA[key];
    let folder = folders.get(spec.folder);
    if (!folder) {
      // Collapsed. There are enough knobs now that an expanded pane is taller than a phone screen, and
      // the thing actually being read on a phone is the frame time above -- which stays open.
      folder = pane.addFolder({ title: spec.folder, expanded: false });
      folders.set(spec.folder, folder);
    }
    // A colour is still a number (0xRRGGBB); `view: 'color'` is what turns the slider into a picker.
    if (isColor(key)) folder.addBinding(params, key, { view: 'color' });
    else if (spec.options) folder.addBinding(params, key, { options: spec.options });
    else folder.addBinding(params, key, { min: spec.min, max: spec.max, step: spec.step });
  }

  // The readouts above are bound to quality's own fields, and Tweakpane only redraws a readonly binding
  // when it is refreshed -- so this is what makes them move.
  const debug: Debug = { tick: () => perfFolder.refresh() };

  // Dev only. There is no endpoint in the built sketch, and the published build has no reason to write
  // anything -- its values are already baked in from params.json at build time.
  if (!import.meta.env.DEV) return debug;

  const state = { saved: true };
  const status = pane.addBinding(state, 'saved', { readonly: true });
  for (const folder of folders.values()) folder.on('change', () => (state.saved = false));

  pane.addButton({ title: 'save to params.json' }).on('click', async () => {
    const res = await fetch('/__params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toJSON(params)),
    });
    if (!res.ok) {
      console.error('[voxel-rain] save failed:', res.status, await res.text());
      return;
    }
    // Writing params.json is a source change, so Vite reloads the page -- which is the confirmation:
    // what comes back is read from the file, not from memory.
    state.saved = true;
    status.refresh();
  });

  return debug;
};
