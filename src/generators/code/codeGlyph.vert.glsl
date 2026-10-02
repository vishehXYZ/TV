attribute float aSeed;
attribute float aGlyphIndex;
varying vec2 vUv;
varying float vSeed;
varying vec2 vWorldPos;
varying float vGlyphIndex;

void main() {
  vUv = uv;
  vSeed = aSeed;
  vGlyphIndex = aGlyphIndex;
  vec4 worldPos4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xy;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
