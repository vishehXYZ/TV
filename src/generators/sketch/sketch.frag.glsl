uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uAspect;

uniform float uTime;
uniform vec3 uPalette[5];
uniform float uEnergy;
uniform float uLineThickness;

varying vec2 vStagePos;

#include ../shared/maskSample.glsl;
#include ../shared/paletteGradient.glsl;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

const int STROKE_COUNT = 8;
/** How often (seconds) each stroke's jitter re-rolls — a stepped clock, not a smooth wobble, so the
 * outline reads as a hand re-drawing the line each time (classic animation "boil") rather than a
 * digital vibration. */
const float REDRAW_INTERVAL = 0.09;
const float EDGE_SAMPLE_DIST = 0.011;

void main() {
  if (uHasMask < 0.5) discard;

  // Movement/audio energy widens both the stepped redraw jitter and the fast tremor — more
  // agitated, shakier lines the more you move, instead of a fixed wobble regardless of what's
  // actually happening.
  float energyT = min(uEnergy, 1.5);
  float jitterAmp = 0.022 + energyT * 0.055;
  float shakeAmp = 0.006 + energyT * 0.016;

  vec3 colorSum = vec3(0.0);
  float weightSum = 0.0;
  float lineAlpha = 0.0;

  for (int i = 0; i < STROKE_COUNT; i++) {
    float fi = float(i);
    // Each stroke redraws on its own offset schedule so they don't all snap to a new position in
    // sync — that reads as one mechanical flicker rather than several independent pen strokes.
    float tick = floor(uTime / REDRAW_INTERVAL + fi * 3.7);
    vec2 jitterSeed = vec2(tick, fi * 17.0);
    vec2 jitter = (vec2(hash21(jitterSeed), hash21(jitterSeed + 91.7)) - 0.5) * jitterAmp;

    // A fast continuous tremor layered on top of the stepped redraw, out of phase per stroke —
    // this is what actually reads as "shaking" frame to frame, rather than only snapping to a new
    // pose every REDRAW_INTERVAL.
    vec2 shake = vec2(
      sin(uTime * 26.0 + fi * 12.9),
      cos(uTime * 31.0 + fi * 7.3)
    ) * shakeAmp;

    vec2 samplePos = vStagePos + jitter + shake;

    // Cheap edge detector: where the mask changes fastest between nearby samples is the body's
    // silhouette boundary — exactly where a traced outline would fall. Scaling the sample distance
    // by uLineThickness is what actually makes the line bolder or thinner: a wider gap straddles
    // more of the silhouette boundary, so more of the surrounding area reads as "on the line."
    float edgeSampleDist = EDGE_SAMPLE_DIST * uLineThickness;
    float m0 = sampleMask(samplePos);
    float mx = sampleMask(samplePos + vec2(edgeSampleDist, 0.0));
    float my = sampleMask(samplePos + vec2(0.0, edgeSampleDist));
    float edgeStrength = abs(m0 - mx) + abs(m0 - my);
    float strokeLine = smoothstep(0.05, 0.22, edgeStrength);

    // Accumulate ("over" compositing) instead of taking the max — where several of the
    // independently-jittered strokes land close but not exactly on top of each other, they
    // visibly build up into a bolder, denser line, the way repeated pencil passes darken a
    // hand-drawn outline rather than just tracing one clean thin edge.
    lineAlpha += strokeLine * (1.0 - lineAlpha);
    // A touch of per-stroke color variation — reads as colored pencil rather than one flat ink tone.
    vec3 strokeColor = paletteColor(hash21(jitterSeed + 5.3));
    colorSum += strokeColor * strokeLine;
    weightSum += strokeLine;
  }

  if (lineAlpha < 0.02) discard;

  // Weighted average of whichever strokes actually landed here — bounded by construction (an average
  // of palette colors can't exceed the palette's own brightest stop), no separate clamp needed.
  vec3 inkColor = weightSum > 0.001 ? colorSum / weightSum : uPalette[2];

  gl_FragColor = vec4(inkColor, lineAlpha);
}
