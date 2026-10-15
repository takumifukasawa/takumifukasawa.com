// The tick: a short, high square-wave blip on every second -- a digital watch, not a mechanical one --
// alternating between two pitches (tick / tock), timed to the moment the new digit lands.
//
// Synthesised, not sampled: an oscillator and an envelope are the whole sound, and a file would be a
// download for a few milliseconds of audio.
//
// On by default, but browsers refuse to start audio before the viewer has done something on the page. So
// "on" means: it starts with the first tap, click or key anywhere (the AudioContext is resumed inside that
// gesture, which is what unlocks it on iOS). The button turns it off. It goes quiet while the tab is hidden.
import type { Params } from './params.ts';

export type Sound = {
  'on': boolean;
  'toggle': () => void;
  'state': () => string; // the AudioContext's state, or 'none' before the first gesture (debug readout)
  // now: wall-clock epoch seconds, the same clock the lines land on.
  'update': (now: number, params: Params) => void;
};

// How far ahead ticks are put on the audio clock. Scheduling on the audio clock is what keeps them exactly
// on the second; scheduling from the frame loop would jitter by up to a frame. Short enough that a mute
// takes effect almost at once.
const LOOKAHEAD = 0.2;

// Events browsers accept as the user activation that allows audio to start.
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

export const createSound = (): Sound => {
  let context: AudioContext | undefined;
  let output: GainNode | undefined;
  let scheduled = Number.NEGATIVE_INFINITY; // the last second a tick was put on the audio clock

  const start = () => {
    // iOS routes Web Audio through the "ambient" session by default, which the ring/silent switch mutes --
    // so on most iPhones the page was silent with nothing wrong in it. "playback" is the media-player
    // session, which plays through the switch. Safari 17+; elsewhere the property does not exist.
    const session = (navigator as Navigator & { 'audioSession'?: { 'type': string } })['audioSession'];
    if (session) session['type'] = 'playback';
    context = new AudioContext();
    output = context.createGain();
    output.connect(context.destination);
  };

  const tick = (at: number, frequency: number, params: Params) => {
    if (!context || !output) return;
    const oscillator = context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    // A square wave this high is mostly harmonics above hearing that alias back down as grit; a low-pass a
    // little above the fundamental keeps the "digital" edge without the fizz. tickBright scales it.
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = Math.min(frequency * params['tickBright'], context.sampleRate / 2 - 100);
    const gain = context.createGain();
    // Near-instant attack, short exponential decay: a blip, not a beep.
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(params['tickVolume'], at + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + params['tickDecay']);
    oscillator.connect(tone).connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at + params['tickDecay'] + 0.01);
  };

  // Audible only while it is on AND the page is visible. A hidden tab stops the frame loop, so nothing new
  // would be scheduled anyway -- but suspending also cuts what is already queued, and a background tab that
  // keeps ticking is the thing nobody can find to close.
  const apply = () => {
    if (!context) return;
    if (sound['on'] && document.visibilityState === 'visible') void context.resume();
    else void context.suspend();
    // Forget what was scheduled: after a resume, the next second is the first one owed.
    scheduled = Number.NEGATIVE_INFINITY;
  };
  document.addEventListener('visibilitychange', apply);

  const sound: Sound = {
    'on': true,
    'state': () => context?.state ?? 'none',
    'toggle': () => {
      if (!context) start();
      sound['on'] = !sound['on'];
      apply();
    },
    'update': (now, params) => {
      if (!sound['on'] || !context || context.state !== 'running') return;
      // Every second boundary inside the lookahead that has not been scheduled yet. The wall clock and the
      // audio clock are related through `now` sampled this frame, which is accurate to well under a frame.
      const first = Math.max(Math.floor(now) + 1, scheduled + 1);
      for (let second = first; second <= now + LOOKAHEAD; second++) {
        const at = context.currentTime + (second - now);
        tick(at, second % 2 === 0 ? params['tickHigh'] : params['tickLow'], params);
        scheduled = second;
      }
    },
  };

  // The first gesture anywhere unlocks it. Capture phase, so the sketch handling the event cannot hide it.
  // Kept until the context is actually running, not removed on the first event: iOS does not count
  // pointerdown as an activation, only the touchend that follows it. A tap on the mute button is a gesture
  // too, and its own handler runs after this one -- so that first tap turns the sound off, which is what
  // pressing an "on" button means.
  const unlock = () => {
    if (!context) start();
    apply();
    if (context!.state !== 'running') return;
    for (const type of GESTURES) window.removeEventListener(type, unlock, true);
  };
  for (const type of GESTURES) window.addEventListener(type, unlock, true);

  return sound;
};
