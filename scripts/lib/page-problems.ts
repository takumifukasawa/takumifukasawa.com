// What the artifact check (scripts/check-artifacts.ts) may ignore among the problems a page reported.
// Policy of the check, kept apart from the Chrome driver (chrome.ts) that collects the problems.
import type { PageProblem } from './chrome.ts';

// Headless Chrome without a GPU says so, loudly and in several ways. Those messages are about the machine
// running the check, not about the sketch, so they must not read as a broken artifact.
//
// Deliberately an allowlist of known phrases rather than "mentions WebGL": a real shader failure also
// mentions WebGL ("THREE.WebGLProgram: Shader Error ... VALIDATE_STATUS false"), and swallowing that would
// make this check worse than useless -- it would be a green light over a broken build.
// Kept deliberately short, and only for messages about *getting a context at all*. Nothing was guessed
// in from memory: on this machine headless Chrome with --use-angle=swiftshader produces none of these,
// so the list exists for GPU-less machines. Extend it when a real environment actually prints something,
// never pre-emptively -- every entry here is a hole in the check.
const ENVIRONMENT_PHRASES = [
  'Could not create a WebGL context',
  'Automatic fallback to software WebGL',
  'WebGL is disabled',
  'WebGL unavailable',
];

// Anything naming the shader pipeline is the sketch's own problem, whatever else it says.
const SKETCH_PHRASES = ['Shader Error', 'WebGLProgram', 'compile', 'VALIDATE_STATUS', 'gl.getProgramInfoLog'];

export const isEnvironmentProblem = (problem: PageProblem): boolean => {
  if (SKETCH_PHRASES.some((phrase) => problem.text.includes(phrase))) return false;
  return ENVIRONMENT_PHRASES.some((phrase) => problem.text.includes(phrase));
};
