uniform sampler2D uVideo;
uniform vec2 uVideoRepeat;
uniform vec2 uVideoOffset;
uniform float uAspect;

uniform float uBackdropDim;
uniform sampler2D uTrail;

uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;

varying vec2 vStagePos;
varying vec2 vBaseUV;

/** How visible the video stays where you HAVEN'T moved — a faint ghost rather than pure black, so
 * it still reads as "there's an image here" instead of looking broken/empty. */
const float HIDDEN_FLOOR = 0.06;

#include ../shared/maskSample.glsl;

float sampleTrail(vec2 stagePos) {
  vec2 uv = vec2(0.5 - stagePos.x / (2.0 * uAspect), 0.5 + stagePos.y / 2.0);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uTrail, uv).r;
}

void main() {
  vec2 videoUV = vBaseUV * uVideoRepeat + uVideoOffset;
  vec3 videoColor = texture2D(uVideo, videoUV).rgb;

  // Your exact current silhouette is always fully revealed — not just an approximate trail blob —
  // plus the trail's decaying wake lingers a moment after you've moved on, so it still reads as
  // motion "painting" the video rather than a static cutout that's identical whether you're moving
  // or standing still.
  float bodyVal = uHasMask > 0.5 ? smoothstep(0.4, 0.6, sampleMask(vStagePos)) : 0.0;
  float trail = sampleTrail(vStagePos);
  float revealAmount = max(bodyVal, trail);
  float visibility = mix(HIDDEN_FLOOR, 1.0, revealAmount);

  vec3 color = videoColor * visibility;
  color *= (1.0 - uBackdropDim);
  gl_FragColor = vec4(color, 1.0);
}
