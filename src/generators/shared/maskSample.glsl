// Requires uMask (sampler2D), uMaskResolution (vec2), uAspect (float) declared by the including file.
float sampleMask(vec2 stagePos) {
  vec2 uv = vec2(0.5 - stagePos.x / (2.0 * uAspect), 0.5 + stagePos.y / 2.0);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;

  // Cover-crop to the mask's own aspect ratio (the camera's native aspect, e.g. 16:9), matching how
  // BackgroundLayer cover-crops the video texture — without this, a landscape mask stretched onto a
  // portrait phone screen squashes/distorts the whole silhouette instead of just cropping its edges.
  float maskAspect = uMaskResolution.x / uMaskResolution.y;
  vec2 cropRepeat = vec2(1.0);
  vec2 cropOffset = vec2(0.0);
  if (maskAspect > uAspect) {
    cropRepeat.x = uAspect / maskAspect;
    cropOffset.x = (1.0 - cropRepeat.x) / 2.0;
  } else {
    cropRepeat.y = maskAspect / uAspect;
    cropOffset.y = (1.0 - cropRepeat.y) / 2.0;
  }
  uv = uv * cropRepeat + cropOffset;
  vec2 texel = 1.0 / uMaskResolution;
  float m = 0.0;
  m += texture2D(uMask, uv).r;
  m += texture2D(uMask, uv + vec2(texel.x, 0.0)).r;
  m += texture2D(uMask, uv - vec2(texel.x, 0.0)).r;
  m += texture2D(uMask, uv + vec2(0.0, texel.y)).r;
  m += texture2D(uMask, uv - vec2(0.0, texel.y)).r;
  return m / 5.0;
}
