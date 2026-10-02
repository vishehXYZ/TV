uniform float uTime;
uniform float uAspect;
uniform vec3 uPalette[5];
uniform float uEnergy;
uniform vec2 uJoints[13];
uniform int uJointCount;

uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uMaskFeather;

uniform sampler2D uTrail;
uniform float uUseReveal;

uniform float uScale;
uniform float uWarpStrength;
uniform float uFlowSpeed;
uniform float uBandCount;
uniform float uEdgeSoftness;

varying vec2 vStagePos;

#include ../shared/simplexNoise.glsl;
#include ../shared/paletteGradient.glsl;
#include ../shared/maskSample.glsl;

// Continuous, softly-decaying paint-trail texture (see PaintTrail.ts) — a single
// bilinear-filtered tap already reads as smooth and continuous since the texture
// itself uses LinearFilter, unlike the boolean-ish segmentation mask above.
float sampleTrail(vec2 stagePos) {
  vec2 uv = vec2(0.5 - stagePos.x / (2.0 * uAspect), 0.5 + stagePos.y / 2.0);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uTrail, uv).r;
}

float fbm(vec2 p) {
  float total = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    total += snoise(p) * amp;
    p *= 2.02;
    amp *= 0.5;
  }
  return total;
}

void main() {
  vec2 p = vStagePos;

  // Flow field warped toward the body's joints so the field visibly reacts to movement.
  vec2 warp = vec2(0.0);
  for (int i = 0; i < 13; i++) {
    if (i >= uJointCount) break;
    vec2 d = p - uJoints[i];
    float dist = length(d) + 0.001;
    warp += normalize(d) * (0.05 / (dist * dist * 6.0 + 1.0));
  }

  vec2 q = p * uScale + warp * uWarpStrength * (1.0 + uEnergy * 2.5);
  float n1 = fbm(q + uTime * 0.08 * uFlowSpeed);
  float n2 = fbm(q * 1.7 - uTime * 0.05 * uFlowSpeed + 4.2);
  float pattern = fbm(q + vec2(n1, n2) * 1.4);

  float t = pattern * 0.5 + 0.5;

  // Painterly posterization: flat color patches with darker contour lines
  // between them, like distinct brushstrokes rather than smooth gradients.
  float bands = max(uBandCount, 1.0);
  float posterized = floor(t * bands) / bands;
  vec3 color = paletteColor(fract(posterized + uTime * 0.015 * uFlowSpeed));

  float softness = max(uEdgeSoftness, 0.001);
  float bandFrac = fract(t * bands);
  float edge = smoothstep(0.0, softness, bandFrac) * smoothstep(0.0, softness, 1.0 - bandFrac);
  color *= mix(0.55, 1.0, edge);

  float brightness = 0.78 + 0.22 * sin(posterized * 6.2831 + uTime * 0.4);
  color *= brightness * (1.0 + uEnergy * 0.5);

  float alpha = 1.0;

  if (uHasMask > 0.5) {
    float bodyVal = sampleMask(p);
    alpha *= smoothstep(0.5 - uMaskFeather, 0.5 + uMaskFeather, bodyVal);
  }

  if (uUseReveal > 0.5) {
    alpha *= sampleTrail(p);
  }

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(color, alpha);
}
