uniform sampler2D uMap;
uniform float uHasMap;
uniform vec2 uRepeat;
uniform vec2 uOffset;
uniform float uOpacity;
uniform float uDim;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;

varying vec2 vUv;

void main() {
  if (uHasMap < 0.5) discard;

  // Manual repeat/offset instead of relying on THREE's built-in map-transform handling, since this is
  // a fully custom shader — mirrors exactly what BackgroundLayer.updateCover() already computes for
  // cover-cropping and the mirrored-selfie convention.
  vec2 uv = vUv * uRepeat + uOffset;
  vec4 texColor = texture2D(uMap, uv);
  vec3 color = texColor.rgb;

  color *= uBrightness;
  color = (color - 0.5) * uContrast + 0.5;

  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, uSaturation);

  color = clamp(color, 0.0, 1.0);
  color *= (1.0 - uDim);

  gl_FragColor = vec4(color, texColor.a * uOpacity);
}
