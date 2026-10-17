// A few knobs for visitors: a small pane, closed until opened, with the handful of things that are fun to change
// and cannot break the piece. Everything else stays behind ?debug (debug.ts).
//
// Not shown with ?debug (the full pane replaces it), ?capture (stills) or ?clean (screen recordings): a recording
// gets the piece alone. Nothing is saved; a reload starts from params.json again.
import { Pane } from 'tweakpane';
import { isColor, type ParamKey, type Params } from './params.ts';

// The ranges are narrower than the schema's: only what still looks like the piece. waveSpeed stays well inside
// the scheme's 0.5 limit, and waveDamping below 1, where the rings would never die out and the floor would slosh.
const KNOBS: { key: ParamKey; label: string; min?: number; max?: number; step?: number }[] = [
  { key: 'rainRate', label: 'rain', min: 0, max: 60, step: 0.5 },
  { key: 'rainColor', label: 'rain color' },
  { key: 'rippleColor', label: 'ripple color' },
  { key: 'waveSpeed', label: 'ripple speed', min: 0.02, max: 0.4, step: 0.01 },
  { key: 'waveDamping', label: 'ripple life', min: 0.95, max: 0.995, step: 0.001 },
  { key: 'rippleEmission', label: 'ripple glow', min: 0, max: 4, step: 0.05 },
];

export const createControls = (params: Params) => {
  const query = new URLSearchParams(location.search);
  if (query.has('debug') || query.has('capture') || query.has('clean')) return;
  const pane = new Pane({ title: 'voxel rain', expanded: false });
  for (const { key, label, min, max, step } of KNOBS) {
    if (isColor(key)) {
      // Bound through a "#rrggbb" string: bound to the number itself, Tweakpane writes it as 0xrrggbb.
      const shown = { value: `#${params[key].toString(16).padStart(6, '0')}` };
      pane.addBinding(shown, 'value', { label, view: 'color' }).on('change', ({ value }) => {
        params[key] = parseInt(value.slice(1), 16);
      });
    } else {
      pane.addBinding(params, key, { label, min, max, step });
    }
  }
};
