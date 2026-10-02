uniform float uStrokeWidth;
uniform vec3 uPalette[5];
uniform float uTime;
uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uMaskFeather;
uniform float uAspect;
uniform float uInvertMask;

varying vec2 vUv;
varying float vSeed;
varying vec2 vWorldPos;
varying float vSymmetry;
varying float vInnerRatio;
varying float vSharpness;

#include ../shared/starSDF.glsl;
#include ../shared/paletteGradient.glsl;
#include ../shared/maskSample.glsl;

void main() {
  float sdf = starSDF(vUv, vSymmetry, vInnerRatio, vSharpness);
  float outline = smoothstep(uStrokeWidth * 1.4, 0.0, abs(sdf));
  float fill = smoothstep(0.05, -0.05, sdf);

  vec3 baseColor = paletteColor(fract(vSeed * 1.7 + uTime * 0.04));
  vec3 glow = mix(baseColor, vec3(1.6, 1.35, 0.9), 0.7);
  vec3 color = baseColor * fill * 0.4 + glow * outline;
  float alpha = clamp(fill * 0.3 + outline, 0.0, 1.0);

  if (uHasMask > 0.5) {
    float bodyVal = sampleMask(vWorldPos);
    float bodyAlpha = smoothstep(0.5 - uMaskFeather, 0.5 + uMaskFeather, bodyVal);
    // uInvertMask > 0.5: hide inside the body (cut the silhouette out as empty space).
    float outsideBody = mix(bodyAlpha, 1.0 - bodyAlpha, uInvertMask);
    alpha *= outsideBody;
  }

  if (alpha < 0.02) discard;
  gl_FragColor = vec4(color, alpha);
}
