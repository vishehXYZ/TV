uniform float uAspect;
varying vec2 vStagePos;
varying vec2 vBaseUv;

void main() {
  // See girih.vert.glsl for why this needs uAspect — position.xy is local geometry space and doesn't
  // reflect the mesh's own scale.x=aspect transform on its own.
  vStagePos = vec2(position.x * uAspect, position.y);
  vBaseUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
