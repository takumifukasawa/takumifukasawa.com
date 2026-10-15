// The sound button, top-right, opposite the link back to the site (public/_shell.js, top-left) and drawn to
// match it: an outlined circle with an icon and no label, difference-blended so it reads over anything.
// Not shown with ?clean (recording the screen) or ?capture (stills copy only the canvas anyway).
//
// Sketch-local on purpose: this is the first sketch with sound. Move it to lab/core/ only once the same
// button has been written three times (lab/core/AGENTS.md).
const ICON_OFF = '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>';
const ICON_ON = '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/>';

export const createMuteButton = (isOn: () => boolean, toggle: () => void) => {
  const query = new URLSearchParams(location.search);
  if (query.has('clean') || query.has('capture')) return;

  const host = document.createElement('div');
  host.style.cssText = 'position: fixed; top: 12px; right: 12px; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      button {
        display: grid;
        place-items: center;
        box-sizing: border-box;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 1px solid #fff;
        border-radius: 50%;
        background: none;
        color: #fff;
        mix-blend-mode: difference;
        opacity: 0.7;
        cursor: pointer;
      }
      button:hover, button:focus-visible { opacity: 1; }
      svg { display: block; }
    </style>
    <button type="button">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>
    </button>
  `;
  const button = root.querySelector('button')!;
  const svg = root.querySelector('svg')!;
  const render = () => {
    svg.innerHTML = isOn() ? ICON_ON : ICON_OFF;
    button.setAttribute('aria-label', isOn() ? 'ミュートする' : '音を出す');
    button.setAttribute('aria-pressed', String(isOn()));
  };
  button.addEventListener('click', () => {
    toggle();
    render();
  });
  // A tap on the button is not a tap on the sketch: keep it from moving the camera.
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  render();
  document.body.appendChild(host);
};
