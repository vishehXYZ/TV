varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
uniform float uTime;

void main() {
  float d = length(vUv);
  float angle = atan(vUv.y, vUv.x);

  // Organic undulating boundary — three harmonics at different
  // frequencies/phases (offset per-instance by vSeed) so each blob wobbles
  // on its own rhythm instead of a hard confetti-chip circle. Reads as a
  // soft jellyfish body / drifting wave-foam clump.
  float wobble =
    0.10 * sin(angle * 3.0 + uTime * 1.3 + vSeed * 6.283) +
    0.06 * sin(angle * 5.0 - uTime * 0.9 + vSeed * 12.0) +
    0.04 * sin(angle * 7.0 + uTime * 1.7 + vSeed * 3.0);
  float edgeRadius = 0.78 + wobble;

  float edge = smoothstep(edgeRadius, edgeRadius - 0.24, d);
  float alpha = edge * vAlpha;
  if (alpha < 0.02) discard;

  // Subtle concentric ripple through the body, like light through water/gel.
  float ripple = 0.5 + 0.5 * sin(d * 16.0 - uTime * 2.2 + vSeed * 10.0);
  alpha *= mix(0.82, 1.0, ripple);

  // Glass/water material feel: a bright fresnel-like rim near the boundary
  // (like light catching the edge of a water droplet or glass blob), plus a
  // soft offset specular highlight — reads as a solid translucent material
  // rather than a flat transparent color fill.
  float rim = smoothstep(edgeRadius - 0.14, edgeRadius, d) * edge;
  vec3 color = mix(vColor, mix(vColor, vec3(1.0), 0.65), rim * 0.7);

  vec2 highlightOffset = vUv - vec2(-0.26 + 0.08 * sin(uTime * 0.6 + vSeed * 8.0), 0.3);
  float highlight = smoothstep(0.24, 0.0, length(highlightOffset));
  color = mix(color, vec3(1.0), highlight * 0.55);

  gl_FragColor = vec4(color, alpha);
}
