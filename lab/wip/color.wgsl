// A surface cell's color from its state. Human-written (AGENTS.md: visual behavior).
// Runs in the fragment stage (plan: decision log), so it may vary per pixel only through `state`.
//
//   state       vec4f(u, v, paint, spare) of this cell, as step.wgsl last wrote it
//   colorRange  knob (params.ts): |disp| at which the color is fully the wave's
//   glow        knob (params.ts): how far above 1 the wave's colors go, so only they pass the bloom's threshold
//   restColor, sinkColor, riseColor  knobs (params.ts, colour folder), linear
//   sinkIntensity, riseIntensity     knobs: times glow, so a dark or blue color can still pass the bloom's threshold
// fn cellColor(state: vec4f) -> vec3f {
//   return vec3f(0.8);
// }

fn cellColor(state: vec4f, colorRange: f32, glow: f32, restColor: vec3f, sinkColor: vec3f, riseColor: vec3f, sinkIntensity: f32, riseIntensity: f32) -> vec3f {
  let rest = restColor; // 止まっている。全チャンネルを持たせ、色収差で縁が割れるように
  let sink = sinkColor * sinkIntensity * glow; // disp が正（中心へ沈む）。1 を超えてブルームで光る
  let rise = riseColor * riseIntensity * glow; // disp が負（外へ盛り上がる）
  // 変位の大きさで、止まっている色から段階的に変える。sqrt で小さい揺れも色に出す
  let t = sqrt(clamp(abs(state.x) / colorRange, 0., 1.));
  return mix(rest, select(rise, sink, state.x > 0.), t);
}
