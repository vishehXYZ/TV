uniform float uTime;
uniform float uAspect;
uniform float uDensity;
uniform float uSymmetry;
uniform float uSharpness;
uniform float uInnerRatio;
uniform float uStrokeWidth;
uniform vec3 uPalette[5];
uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uMaskFeather;
uniform vec4 uBones[12];
uniform int uBoneCount;
uniform float uWarpStrength;
uniform float uEnergy;
uniform float uOpacity;

varying vec2 vStagePos;

#include ../shared/starSDF.glsl;
#include ../shared/paletteGradient.glsl;
#include ../shared/maskSample.glsl;

float ringStroke(float sdf, float width) {
  return smoothstep(width, 0.0, abs(sdf));
}

void main() {
  vec2 worldPos = vStagePos;

  // Skeletal-subspace warp: blend the local sampling frame toward the
  // tangent of nearby limb bones so the lattice flows along the body
  // instead of sitting on a rigid world grid.
  float totalWeight = 0.0;
  float sinSum = 0.0;
  float cosSum = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uBoneCount) break;
    vec4 bone = uBones[i];
    vec2 a = bone.xy;
    vec2 b = bone.zw;
    vec2 ab = b - a;
    float len = length(ab);
    vec2 dir = len > 0.0001 ? ab / len : vec2(1.0, 0.0);
    vec2 ap = worldPos - a;
    float t = clamp(dot(ap, dir) / max(len, 0.0001), 0.0, 1.0);
    vec2 closest = a + dir * t * len;
    float dist = length(worldPos - closest);
    float w = 1.0 / (dist * dist * 30.0 + 1.0);
    float angle = atan(dir.y, dir.x);
    sinSum += sin(angle) * w;
    cosSum += cos(angle) * w;
    totalWeight += w;
  }

  float boneAngle = totalWeight > 0.0001 ? atan(sinSum, cosSum) : 0.0;
  float warpBlend = clamp(totalWeight * uWarpStrength, 0.0, 1.0);
  float drift = uTime * 0.03;
  vec2 warped = rotate2d(-boneAngle * warpBlend - drift) * worldPos;

  vec2 cellCoord = warped * uDensity;
  vec2 cellId = floor(cellCoord);
  vec2 cellUV = fract(cellCoord) - 0.5;

  float h = hash21(cellId);
  float h2 = hash21(cellId + 17.23);
  float cellRot = floor(h * 6.0) * (3.14159265 / 3.0);
  // uEnergy previously only shifted this wave's phase, which changes *when* it pulses but not how
  // strong it looks at a glance — reads as basically static to the eye. Multiplying the whole pulse
  // by an energy-driven factor gives a real, visible amplitude swell tied to movement/music.
  float pulse = (0.75 + 0.25 * sin(uTime * 1.4 + h * 6.2831 + uEnergy * 4.0)) * (1.0 + uEnergy * 0.35);

  vec2 p = rotate2d(cellRot) * (cellUV * 2.05);

  // Outer star outline (main girih rosette silhouette).
  float sdfOuter = starSDF(p, uSymmetry, uInnerRatio, uSharpness);
  float outlineOuter = ringStroke(sdfOuter, uStrokeWidth);
  float fillOuter = smoothstep(0.015, -0.015, sdfOuter);

  // Smaller counter-rotated inner star (classic nested double-star motif).
  vec2 pInner = rotate2d(3.14159265 / uSymmetry + h2 * 0.6) * (p / max(uInnerRatio, 0.15) * 0.5);
  float sdfInner = starSDF(pInner, uSymmetry, uInnerRatio, uSharpness);
  float outlineInner = ringStroke(sdfInner, uStrokeWidth * 0.75);
  float fillInner = smoothstep(0.012, -0.012, sdfInner);

  // Thin radiating spokes toward each star point, and a central medallion dot.
  float theta = atan(p.y, p.x);
  float spokeMask = pow(abs(cos(uSymmetry * 0.5 * theta)), 36.0);
  float spokeLine = smoothstep(0.55, 1.0, spokeMask) * smoothstep(0.98, 0.1, length(p));
  float core = smoothstep(0.1, 0.0, length(p)) * (1.0 - smoothstep(0.05, 0.06, length(p)) * 0.0);

  float linework = clamp(outlineOuter + outlineInner * 0.85 + spokeLine * 0.55 + core * 0.6, 0.0, 1.0);
  float fill = clamp(fillOuter * 0.3 + fillInner * 0.22, 0.0, 1.0);

  float radialT = clamp(length(p), 0.0, 1.0);
  vec3 baseColor = paletteColor(fract(h * 1.7 + radialT * 0.4 + uTime * 0.01));
  vec3 glowColor = mix(baseColor, vec3(1.7, 1.4, 0.85), 0.72) * (1.0 + uEnergy * 0.8);

  vec3 color = baseColor * fill * pulse + glowColor * linework * pulse;
  float shapeAlpha = clamp(fill * 0.6 + linework, 0.0, 1.0);

  float maskVal = uHasMask > 0.5 ? sampleMask(worldPos) : 1.0;
  float maskAlpha = smoothstep(0.5 - uMaskFeather, 0.5 + uMaskFeather, maskVal);

  float alpha = shapeAlpha * maskAlpha * uOpacity;
  if (alpha < 0.008) discard;

  gl_FragColor = vec4(color, alpha);
}
