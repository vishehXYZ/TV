uniform float uAspect;
varying vec2 vStagePos;

void main() {
  // position.xy is LOCAL geometry space (-1..1) — it does NOT reflect the mesh's own scale.x=aspect
  // transform (that only affects gl_Position via modelViewMatrix, not this raw attribute). Without
  // multiplying by uAspect here, vStagePos silently stays confined to (-1..1) regardless of aspect,
  // which on a portrait screen (aspect < 1) sampled the mask through a much narrower band than the
  // actual visible width — the real cause behind mask-based effects looking "confined to a box" on
  // phones, confirmed via direct pixel-boundary testing (effect cut off at exactly the predicted
  // 27%-73% width band on a 0.46 aspect canvas).
  vStagePos = vec2(position.x * uAspect, position.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
