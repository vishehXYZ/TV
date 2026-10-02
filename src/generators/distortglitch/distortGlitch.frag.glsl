uniform sampler2D uVideo;
uniform vec2 uVideoRepeat;
uniform vec2 uVideoOffset;

uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uAspect;

uniform float uTime;
/** Overall distortion intensity: a smoothed movement-driven baseline plus short decaying bursts, set from JS. */
uniform float uGlitchAmount;
uniform float uBackdropDim;
uniform vec3 uPalette[5];
uniform float uPaletteAmount;

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
  vec2 baseUV = vBaseUV;

  float bodyVal = uHasMask > 0.5 ? sampleMask(vStagePos) : 0.0;
  float bodyAlpha = smoothstep(0.1, 0.7, bodyVal);
  // The distortion reads as coming from the body: background gets a reduced trace, the silhouette gets
  // the full effect. Floor is high enough to clearly read during sound-only (no-body) performance.
  float localGlitch = uGlitchAmount * mix(0.4, 1.0, bodyAlpha);

  // Bold continuous layered sine waves — flowing, rippling line distortion with real visible amplitude, like torn analog signal.
  float wave1 = sin(baseUV.y * 22.0 + uTime * 3.2) * 0.035;
  float wave2 = sin(baseUV.y * 58.0 - uTime * 5.8) * 0.018;
  float wave3 = sin(baseUV.y * 8.0 + uTime * 1.4) * 0.05;
  float distortion = (wave1 + wave2 + wave3) * localGlitch;

  vec2 distortedUV = vec2(baseUV.x + distortion, baseUV.y);
  vec2 videoUV = distortedUV * uVideoRepeat + uVideoOffset;

  // Strong, visibly colorful chromatic split riding the wave — each channel offset differently.
  float fringe = 0.028 * localGlitch;
  float rC = texture2D(uVideo, videoUV + vec2(fringe, 0.0)).r;
  float gC = texture2D(uVideo, videoUV + vec2(-fringe * 0.4, fringe * 0.3)).g;
  float bC = texture2D(uVideo, videoUV - vec2(fringe, 0.0)).b;
  vec3 color = vec3(rC, gC, bC);

  // Colorful per-channel grain — independent hash seeds per channel so the noise itself reads as chromatic static, not gray.
  vec2 grainUV = baseUV * vec2(680.0, 420.0) + floor(uTime * 26.0);
  float gr = hash21(grainUV) - 0.5;
  float gg = hash21(grainUV + 91.7) - 0.5;
  float gb = hash21(grainUV + 233.1) - 0.5;
  color += vec3(gr, gg, gb) * 0.5 * localGlitch;

  // Palette-colored glitch streaks: horizontal bands that flash in a palette color, ties the effect directly to the chosen palette.
  float streakRow = floor(baseUV.y * 28.0);
  float streakTick = floor(uTime * 9.0);
  float streakRand = hash21(vec2(streakRow, streakTick));
  float streakActive = step(1.0 - localGlitch * 0.5, streakRand);
  vec3 streakColor = paletteColor(hash21(vec2(streakRow, streakTick + 4.1)));
  color = mix(color, streakColor, streakActive * 0.6);

  // Occasional full-width horizontal tear: a thin band snaps to a shifted, palette-tinted sample.
  float tearTick = floor(uTime * 6.0);
  float tearRow = hash11(tearTick);
  float tearActive = step(abs(baseUV.y - tearRow), 0.025) * step(0.7, hash11(tearTick + 5.2)) * step(0.05, localGlitch);
  if (tearActive > 0.5) {
    vec2 tearUV = vec2(fract(baseUV.x + (hash11(tearTick + 1.7) - 0.5) * 0.4), baseUV.y) * uVideoRepeat + uVideoOffset;
    vec3 tearColor = texture2D(uVideo, tearUV).rgb;
    color = mix(tearColor, paletteColor(hash11(tearTick + 8.3)), 0.4);
  }

  // Scanline texture for an analog-broadcast undertone.
  float scan = 0.9 + 0.1 * sin(baseUV.y * 900.0 + uTime * 2.0);
  color *= mix(1.0, scan, clamp(localGlitch, 0.0, 1.0) * 0.7);

  // Overall color-grade toward the shared app palette (by luminance), scaling in with intensity for a cohesive stylized look.
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 graded = paletteColor(lum);
  color = mix(color, graded, uPaletteAmount * clamp(localGlitch * 2.0, 0.0, 1.0));

  color *= (1.0 - uBackdropDim);
  gl_FragColor = vec4(color, 1.0);
}
