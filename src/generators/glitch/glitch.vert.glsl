uniform float uAspect;
varying vec2 vStagePos;
varying vec2 vBaseUV;

void main() {
  // See girih.vert.glsl for why this needs uAspect. vBaseUV is unaffected — it's a plain local UV
  // used with its own separate uVideoRepeat/uVideoOffset cover-crop, not vStagePos's mask sampling.
  vStagePos = vec2(position.x * uAspect, position.y);
  vBaseUV = position.xy * 0.5 + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
