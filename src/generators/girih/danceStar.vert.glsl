attribute float aSeed;
attribute float aSymmetry;
attribute float aInnerRatio;
attribute float aSharpness;
varying vec2 vUv;
varying float vSeed;
varying vec2 vWorldPos;
varying float vSymmetry;
varying float vInnerRatio;
varying float vSharpness;

void main() {
  vUv = position.xy;
  vSeed = aSeed;
  vSymmetry = aSymmetry;
  vInnerRatio = aInnerRatio;
  vSharpness = aSharpness;
  vec4 worldPos4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = worldPos4.xy;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
