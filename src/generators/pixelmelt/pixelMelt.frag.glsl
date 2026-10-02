uniform sampler2D uVideo;
uniform vec2 uVideoRepeat;
uniform vec2 uVideoOffset;

uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uAspect;

uniform float uTime;
/** Smoothed 0..1 — eased toward a movement-driven target in JS, drives block chunkiness and drip strength together. */
uniform float uMeltAmount;
uniform float uBackdropDim;
uniform vec3 uPalette[5];
uniform float uPaletteAmount;

varying vec2 vStagePos;
varying vec2 vBaseUV;

#include ../shared/maskSample.glsl;
#include ../shared/paletteGradient.glsl;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float bodyVal = uHasMask > 0.5 ? sampleMask(vStagePos) : 0.0;
  float bodyAlpha = smoothstep(0.15, 0.85, bodyVal);
  // Applies across the whole image (not just a tight silhouette): background gets a reduced trace, the
  // body gets the full effect. Floor is high enough to clearly read during sound-only (no-body) performance.
  float localAmount = uMeltAmount * mix(0.5, 1.0, bodyAlpha);

  vec3 sharp = texture2D(uVideo, vBaseUV * uVideoRepeat + uVideoOffset).rgb;

  if (localAmount < 0.01) {
    gl_FragColor = vec4(sharp * (1.0 - uBackdropDim), 1.0);
    return;
  }

  // Big, unmistakably chunky mosaic blocks — few enough at full intensity to read as bold pixel art, not a blur.
  float blockCountX = mix(140.0, 9.0, clamp(localAmount, 0.0, 1.0));
  float blockCountY = blockCountX * uAspect;
  vec2 blockId = floor(vec2(vBaseUV.x * blockCountX, vBaseUV.y * blockCountY));
  vec2 blockUV = (blockId + 0.5) / vec2(blockCountX, blockCountY);

  // Row-level jitter re-rolled on a stepped clock (not a continuous drip) —
  // reads as digital block displacement/glitch rather than melting wax. Only
  // a subset of rows glitch on any given tick; most blocks stay put.
  float rowId = floor(vBaseUV.y * blockCountY);
  float glitchTick = floor(uTime * 6.0);
  float rowSeed = hash21(vec2(rowId, glitchTick));
  float rowActive = step(0.72, rowSeed);
  float jitterX = (hash21(vec2(rowId, glitchTick + 13.0)) - 0.5) * 0.12 * localAmount * rowActive;

  vec2 jitteredBlockUV = clamp(blockUV + vec2(jitterX, 0.0), vec2(0.001), vec2(0.999));

  // Slight RGB channel split scaled with intensity — subtle chromatic glitch fringing.
  float splitAmt = 0.01 * localAmount;
  float rCh = texture2D(uVideo, (jitteredBlockUV + vec2(splitAmt, 0.0)) * uVideoRepeat + uVideoOffset).r;
  float gCh = texture2D(uVideo, jitteredBlockUV * uVideoRepeat + uVideoOffset).g;
  float bCh = texture2D(uVideo, (jitteredBlockUV - vec2(splitAmt, 0.0)) * uVideoRepeat + uVideoOffset).b;
  vec3 pixelColor = vec3(rCh, gCh, bCh);

  // Occasional hard flicker-fade on active glitch rows instead of a wax-drip fade.
  float flicker = 1.0 - rowActive * (0.5 + 0.5 * hash21(vec2(rowId, glitchTick + 41.0))) * 0.35;
  pixelColor *= flicker;

  vec3 color = mix(sharp, pixelColor, localAmount);

  // Bold dark grid lines between tiles — makes it read unmistakably as chunky pixel/mosaic art, not a blur.
  vec2 blockFrac = fract(vec2(vBaseUV.x * blockCountX, vBaseUV.y * blockCountY));
  float gridLine = min(min(blockFrac.x, 1.0 - blockFrac.x), min(blockFrac.y, 1.0 - blockFrac.y));
  float gridDark = smoothstep(0.12, 0.0, gridLine) * localAmount * 0.55;
  color *= (1.0 - gridDark);

  // Color-grade toward the shared app palette (by luminance) for a stylized cinematic look, scaling in with intensity.
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 graded = paletteColor(lum);
  color = mix(color, graded, uPaletteAmount * localAmount);

  color *= (1.0 - uBackdropDim);
  gl_FragColor = vec4(color, 1.0);
}
