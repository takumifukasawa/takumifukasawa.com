// The edge of each box: where it is, and what it does to the surface. Written by hand (AGENTS.md: the
// shader core is not the agent's to finish). edges.ts only gets these inputs here and calls edge().
//
// Available here:
//   uEdgeColor     vec3   the edgeColor knob (linear)
//   uEdgeWidth     float  the edgeWidth knob, in WORLD units
//   uEdgeStrength  float  the edgeStrength knob
//
// Arguments:
//   local  the fragment's position on the unit box BEFORE instance scaling.
//          x and z run -0.5..0.5, y runs 0..1 (the pivot is the bottom face, blocks.ts).
//   size   the instance's scale per axis = the box's real width / height / depth in world units.
//          local * size is therefore a real distance, which is what keeps the edge the same width on a
//          long thin box and a small square one.
//   albedo diffuseColor.rgb, after the material colour is applied. Lit afterwards.
//   emission totalEmissiveRadiance. Added after lighting -- this is the one that bloom can pick up.
//
// Note: leaves inside a plate are flush (blocks.ts insets only on plate edges), so an edge on every box
// also draws the seams between the leaves of one panel.
//
// Written by the agent this once, on the human's explicit go-ahead (2026-10-14) -- same exception as
// greeble, not a change of policy.
void edge(inout vec3 albedo, inout vec3 emission, vec3 local, vec3 size) {
  // Real distance to the nearest boundary along each axis. On a face, the axis along its normal is ~0
  // (the fragment sits ON that boundary); the distance to the edge of THAT face is the next smallest one.
  vec3 d = vec3(
    (0.5 - abs(local.x)) * size.x,
    min(local.y, 1.0 - local.y) * size.y,
    (0.5 - abs(local.z)) * size.z
  );
  // Second smallest of three: the middle value.
  float toEdge = d.x + d.y + d.z - min(d.x, min(d.y, d.z)) - max(d.x, max(d.y, d.z));

  // Coverage of the band [0, width] by this pixel's footprint, not a hard threshold. A hard edge thinner
  // than a pixel lands on some pixels and misses the next ones as the camera drifts -- the same flicker
  // the bloom had, at the source. With coverage a far-away edge fades out instead of shimmering.
  float footprint = max(fwidth(toEdge), 1e-6);
  float lo = max(toEdge - footprint * 0.5, 0.0);
  float hi = min(toEdge + footprint * 0.5, uEdgeWidth);
  float mask = clamp((hi - lo) / footprint, 0.0, 1.0);

  // Strength 0..1 paints the edge (lit like the rest of the box, so it stays out of the bloom);
  // above 1 the excess glows, and bloom picks that up.
  albedo = mix(albedo, uEdgeColor, mask * clamp(uEdgeStrength, 0.0, 1.0));
  emission += uEdgeColor * mask * max(uEdgeStrength - 1.0, 0.0);
}
