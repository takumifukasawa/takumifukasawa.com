// /_shell.js — link back to the site + analytics, loaded by every sketch page (/lab/<slug>/).
// Every sketch embeds `<script src="/_shell.js" defer></script>`; everything else lives here, so changing
// this one file updates all sketches without rebuilding them. Contract: docs/decisions/0004-lab-shell.md.
//
// The link is an outlined circle with a back arrow, in the corner. No wordmark (see the note by the markup).

// Measured separately from the link below: the link is a visual affordance that a sketch can turn off,
// while "how many people opened this sketch" should be counted either way. The only skip is an iframe,
// where the host page is the thing being viewed and does its own counting (decision 0004).
//
// Kept inside the IIFE: this file is a classic script, so a top-level `const` would sit in the global
// lexical scope and could collide with the sketch's own variables.
(() => {
  try {
    if (window.top !== window) return;
    if (window.gtag) return;

    // Google Analytics 4. Public (it ships in the HTML), so it is not a secret. The same id is written in
    // src/pages/index.astro for the site itself — change both together.
    const GA_ID = 'G-L3EDWSFJ82';

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(tag);

    window.dataLayer = window.dataLayer || [];
    // gtag reads `arguments`, so it cannot be an arrow function.
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  } catch {
    // ignore
  }
})();

(() => {
  // Never break the sketch: any failure here is swallowed.
  try {
    // Inside an iframe (e.g. if sketches are later wrapped by a site template) the host page owns the link.
    if (window.top !== window) return;

    const html = document.documentElement;
    if (html.dataset.shell === 'none') return;
    // ?clean hides everything (for recording).
    if (new URLSearchParams(location.search).has('clean')) return;

    const POSITIONS = {
      'top-left': 'top: 12px; left: 12px;',
      'top-right': 'top: 12px; right: 12px;',
      'bottom-left': 'bottom: 12px; left: 12px;',
      'bottom-right': 'bottom: 12px; right: 12px;',
    };
    const position = POSITIONS[html.dataset.shellPosition] ?? POSITIONS['top-left'];

    // Isolate from the sketch's DOM and CSS.
    const host = document.createElement('div');
    host.setAttribute('data-site-shell', '');
    host.style.cssText = `position: fixed; ${position} z-index: 2147483647; pointer-events: none;`;
    const root = host.attachShadow({ mode: 'open' });
    // An outlined circle with an arrow in it, and no wordmark. The name next to the arrow was a label on
    // a control that only does one thing, on a page whose only other link is the sketch itself -- so it
    // was text explaining a thing that does not need explaining, over someone's work. Dropping it lets
    // the target be big enough to hit on a phone without the corner of the frame becoming a signature.
    //
    // The accessible name moves to aria-label: a screen reader still needs to be told where this goes.
    // mix-blend-mode keeps the ring and the arrow legible over whatever the sketch happens to render
    // underneath, which is why there is no fill -- a solid chip would cover the piece.
    //
    // The arrow is drawn, not typed. A text glyph sits wherever its font puts it inside the line box, and
    // that differs across platforms -- centring it by eye here would be centring it for this machine only.
    // A path in a square viewBox lands in the same place everywhere.
    root.innerHTML = `
      <style>
        a {
          pointer-events: auto;
          display: grid;
          place-items: center;
          box-sizing: border-box;
          width: 40px;
          height: 40px;
          border: 1px solid #fff;
          border-radius: 50%;
          color: #fff;
          mix-blend-mode: difference;
          text-decoration: none;
          opacity: 0.7;
        }
        a:hover, a:focus-visible { opacity: 1; }
        svg { display: block; }
      </style>
      <a href="/" aria-label="takumifukasawa.com">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 12H6M11 7l-5 5 5 5"/>
        </svg>
      </a>
    `;
    document.body.appendChild(host);

    // `h` toggles visibility. Ignore it while typing (inputs, Tweakpane fields) and when the sketch handled
    // the key itself. defaultPrevented is read after dispatch finishes, so listener order does not matter.
    const isTyping = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'h' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping()) return;
      setTimeout(() => {
        if (event.defaultPrevented) return;
        host.style.display = host.style.display === 'none' ? '' : 'none';
      }, 0);
    });
  } catch {
    // ignore
  }
})();
