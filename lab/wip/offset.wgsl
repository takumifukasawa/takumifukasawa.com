// How far a surface cell's box moves, from its state. Human-written (AGENTS.md: visual behavior).
// Runs in the vertex stage, once per vertex, so all 8 corners of a box get the same offset and it moves as a whole.
//
//   state         vec4f(u, v, paint, spare) of this cell, as step.wgsl last wrote it
//   cellPosition  this cell's center in the shape's space: origin at the shape's center, one cell = 1
//   offsetScale   knob (params.ts)
//   offsetCurve   knob (params.ts)
//
// Returns the offset in the same space.
fn cellOffset(state: vec4f, cellPosition: vec3f, offsetScale: f32, offsetCurve: f32) -> vec3f {
  let center = vec3f(0.0); // 今回は必ず中央なので
  let posToCenter = center - cellPosition;
  let posToCenterDir = normalize(posToCenter);
  // 変位を取得。小さい揺れを持ち上げる: |x|^curve（curve < 1 で、遠くの小さい輪も見えるようにし、中央の飛び出しは抑える）。符号は保つ
  let disp = sign(state.x) * pow(abs(state.x), offsetCurve) * offsetScale;
  return disp * posToCenterDir; // 中心方向に変位分だけオフセット
}
