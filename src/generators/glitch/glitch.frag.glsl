uniform sampler2D uVideo;
uniform vec2 uVideoRepeat;
uniform vec2 uVideoOffset;

uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uAspect;

uniform float uTime;
/** Overall glitch intensity: a smoothed movement-driven baseline plus short decaying bursts, set from JS. */
uniform float uGlitchAmount;
/** 0 = full brightness, higher = darker backdrop — shared with the rest of the app's Light/Dark backdrop control. */
uniform float uBackdropDim;
uniform vec3 uPalette[5];
uniform float uPaletteAmount;
/** When >0.5, static cells use plain random RGB noise and the final palette color-grade is skipped — the original non-colorful glitch look. */
uniform float uMonochrome;
/** When >0.5, renders a fine comb of individually color-split scanlines instead of chunky block static — a different flavor of glitch. */
uniform float uFineLines;

varying vec2 vStagePos;
varying vec2 vBaseUV;

#include ../shared/maskSample.glsl;
#include ../shared/paletteGradient.glsl;

float hash11(float x) {
  return fract(sin(x * 127.1) * 43758.5453);
}
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 videoUV = vBaseUV * uVideoRepeat + uVideoOffset;

  float bodyVal = uHasMask > 0.5 ? sampleMask(vStagePos) : 0.0;
  float bodyAlpha = smoothstep(0.1, 0.7, bodyVal);
  // The glitch reads as coming from the body: background gets a reduced trace of it, the silhouette
  // gets the full effect. Floor is high enough to clearly read during sound-only (no-body) performance.
  float localGlitch = uGlitchAmount * mix(0.4, 1.0, bodyAlpha);

  // Stepped "glitch tick" clock — displacement jumps discretely between ticks instead of smoothly wobbling, for an authentic digital-hiccup feel.
  float tick = floor(uTime * 14.0);

  // Per-row horizontal block displacement (classic datamosh/signal-tear look).
  float rowId = floor(vBaseUV.y * 46.0);
  float rowRand = hash21(vec2(rowId, tick));
  float rowActive = step(1.0 - clamp(localGlitch, 0.0, 1.0) * 0.6, rowRand);
  float shift = (hash21(vec2(rowId, tick + 91.7)) - 0.5) * 0.14 * localGlitch;
  vec2 glitchedUV = videoUV + vec2(shift * rowActive, 0.0);

  // RGB channel split — offset direction flips per tick, magnitude scales with intensity.
  float dir = hash11(tick) > 0.5 ? 1.0 : -1.0;
  float splitAmt = 0.014 * localGlitch * dir;
  float rC = texture2D(uVideo, glitchedUV + vec2(splitAmt, 0.0)).r;
  float gC = texture2D(uVideo, glitchedUV).g;
  float bC = texture2D(uVideo, glitchedUV - vec2(splitAmt, 0.0)).b;
  vec3 color = vec3(rC, gC, bC);

  // Blocky signal-static cells (classic datamosh) OR a fine comb of individually
  // color-split scanlines (a very different, more delicate colorful-glitch flavor),
  // depending on which Glitch style is active.
  if (uFineLines > 0.5) {
    float lineId = floor(vBaseUV.y * 220.0);
    float lineRand = hash21(vec2(lineId, tick));
    float lineActive = step(1.0 - clamp(localGlitch, 0.0, 1.0) * 0.55, lineRand);
    float lineSplit = (hash21(vec2(lineId, tick + 31.0)) - 0.5) * 0.05 * localGlitch;
    float rL = texture2D(uVideo, videoUV + vec2(lineSplit, 0.0)).r;
    float gL = texture2D(uVideo, videoUV).g;
    float bL = texture2D(uVideo, videoUV - vec2(lineSplit, 0.0)).b;
    vec3 lineColor = vec3(rL, gL, bL);
    // A colorful palette tint on lit lines — reads as delicate chromatic scanlines rather than a raw RGB smear.
    vec3 tint = paletteColor(hash21(vec2(lineId, 2.7)));
    lineColor = mix(lineColor, lineColor * tint * 1.6, 0.55);
    color = mix(color, lineColor, lineActive * 0.9);
  } else {
    vec2 blockUV = floor(vBaseUV * vec2(64.0, 36.0));
    float blockRand = hash21(blockUV + tick * 3.7);
    float staticAmt = step(1.0 - clamp(localGlitch, 0.0, 1.0) * 0.4, blockRand);
    vec3 staticColorPalette = paletteColor(hash21(blockUV + 1.1));
    vec3 staticColorRaw = vec3(hash21(blockUV + 1.1), hash21(blockUV + 2.3), hash21(blockUV + 3.7));
    vec3 staticColor = mix(staticColorPalette, staticColorRaw, uMonochrome);
    color = mix(color, staticColor, staticAmt * 0.85);
  }

  // Faint scanline darkening for a broken-signal/CRT undertone, more pronounced as intensity rises.
  float scan = 0.94 + 0.06 * sin(vBaseUV.y * 800.0);
  color *= mix(1.0, scan, clamp(localGlitch, 0.0, 1.0));

  // Color-grade the base video toward the shared app palette (by luminance) — skipped entirely in the monochrome variant.
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 graded = paletteColor(lum);
  color = mix(color, graded, uPaletteAmount * (1.0 - uMonochrome));

  color *= (1.0 - uBackdropDim);
  gl_FragColor = vec4(color, 1.0);
}
