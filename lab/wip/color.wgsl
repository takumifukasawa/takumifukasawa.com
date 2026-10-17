// A surface cell's color from its state. Human-written (AGENTS.md: visual behavior).
// Runs in the fragment stage (plan: decision log), so it may vary per pixel only through `state`.
//
//   state  vec4f(u, v, paint, spare) of this cell, as step.wgsl last wrote it
//
// The stub ignores the state.
fn cellColor(state: vec4f) -> vec3f {
  return vec3f(0.8);
}
