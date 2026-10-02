uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uAspect;

uniform float uTime;
uniform vec3 uPalette[5];
/** Six body-region anchors in stage space (head, left hand, right hand, torso, left leg, right leg) — see ChromaMode.ts. */
uniform vec2 uAnchors[6];
uniform float uAnchorCount;
uniform float uEnergy;

varying vec2 vStagePos;

#include ../shared/maskSample.glsl;
#include ../shared/paletteGradient.glsl;
#include ../shared/simplexNoise.glsl;

void main() {
  float bodyVal = uHasMask > 0.5 ? sampleMask(vStagePos) : 0.0;
  float alpha = smoothstep(0.35, 0.65, bodyVal);
  if (alpha < 0.01) discard;

  // Domain warp: distort the position used for region-color blending (not the mask sample above,
  // which must stay locked to your actual silhouette) through flowing noise with a strong, fast
  // downward drift — this is what makes the colors themselves melt/flow into each other visibly
  // within a couple of seconds, not just over a slow eventual drift. Two octaves at different
  // scales/speeds read as a real liquid marbling swirl instead of one uniform wobble. Amplitudes are
  // large relative to typical anchor spacing on purpose — this needs to stay clearly visible even
  // while a real, actively-moving body dominates the frame, not just detectable in a still frame.
  vec2 warp1 = vec2(
    snoise(vStagePos * 1.4 + uTime * 0.3),
    snoise(vStagePos * 1.4 + uTime * 0.24 + 40.0)
  );
  vec2 warp2 = vec2(
    snoise(vStagePos * 3.2 - uTime * 0.45 + 11.0),
    snoise(vStagePos * 3.2 - uTime * 0.38 + 71.0)
  );
  vec2 meltPos = vStagePos + warp1 * 0.55 + warp2 * 0.22;
  meltPos.y -= uTime * 0.09; // constant strong downward drift — an unmistakable "melting" direction

  // Soft inverse-distance-weighted blend across the body-region anchors, sampled at the melted/warped
  // position — each region still pulls color toward it more strongly the closer a fragment is, but a
  // wide, gentle falloff lets neighboring regions bleed and mix heavily into each other rather than
  // reading as distinct zones with a thin blended seam.
  vec3 color = vec3(0.0);
  float totalWeight = 0.0;
  int count = int(uAnchorCount);
  for (int i = 0; i < 6; i++) {
    if (i >= count) break;
    float d = distance(meltPos, uAnchors[i]);
    float weight = 1.0 / (d * d * 1.1 + 0.05);
    vec3 regionColor = paletteColor(float(i) / 5.0);
    color += regionColor * weight;
    totalWeight += weight;
  }
  color /= max(totalWeight, 0.0001);

  // Multi-scale grain/texture for a genuinely marbled surface rather than a soft color blend — three
  // octaves at increasing frequency (large blotches down to fine surface grain) instead of just two,
  // and a much wider amplitude for clearly visible texture. Safe to push harder than the original
  // range now that the maxChannel safety net below rescales instead of clipping.
  float n1 = snoise(vStagePos * 5.0 + uTime * 0.25);
  float n2 = snoise(vStagePos * 11.0 - uTime * 0.4 + 30.0);
  float n3 = snoise(vStagePos * 24.0 + uTime * 0.15 + 90.0);
  float grain = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2) * 0.5 + 0.5;
  color *= 0.68 + grain * 0.62;

  // Thin bright veins threading through the surface — ridge noise (sharpened near its zero-crossings
  // via a power curve) isolates thin streaks rather than blobs, the standard technique for faking
  // mineral veining in a shader, tying directly into the "marble" name.
  float veinNoise = snoise(meltPos * 3.2 + uTime * 0.07);
  float vein = pow(1.0 - abs(veinNoise), 12.0);
  color += vec3(0.35, 0.32, 0.28) * vein;

  // A gentle overall brighten with movement/audio energy — kept modest for the same reason.
  color *= 1.0 + min(uEnergy, 1.2) * 0.1;

  // Safety net — the region blend plus grain/energy could still creep past 1.0 on already-bright
  // palette stops. Scaling the whole vector down by its brightest channel (rather than a plain
  // clamp()) preserves the color's hue/ratio instead of letting one channel clip to solid white while
  // the others lag behind, which reads as a color shift toward white rather than a smooth brightness cap.
  float maxChannel = max(color.r, max(color.g, color.b));
  if (maxChannel > 1.0) color /= maxChannel;

  gl_FragColor = vec4(color, alpha);
}
