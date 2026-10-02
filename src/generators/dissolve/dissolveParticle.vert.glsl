attribute vec3 aColor;
attribute float aAlpha;
attribute float aSeed;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;

void main() {
  vUv = position.xy;
  vColor = aColor;
  vAlpha = aAlpha;
  vSeed = aSeed;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
