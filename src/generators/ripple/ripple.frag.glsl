uniform sampler2D uVideo;
uniform vec2 uVideoRepeat;
uniform vec2 uVideoOffset;

uniform sampler2D uSelfView;
uniform vec2 uSelfViewRepeat;
uniform vec2 uSelfViewOffset;
uniform float uHasSelfView;

uniform float uAspect;

uniform float uTime;
uniform float uEnergy;
uniform float uBackdropDim;

uniform sampler2D uTrail;

varying vec2 vStagePos;
varying vec2 vBaseUV;

// Continuous, softly-decaying paint-trail texture (see PaintTrail.ts) — high where the body has
// recently moved, decaying smoothly afterward. Same sampling convention as Abstract Grow's reveal.
float sampleTrail(vec2 stagePos) {
  vec2 uv = vec2(0.5 - stagePos.x / (2.0 * uAspect), 0.5 + stagePos.y / 2.0);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uTrail, uv).r;
}

void main() {
  float trail = sampleTrail(vStagePos);

  // The trail field's own spatial gradient points outward from wherever you just moved — pushing
  // the video sample position AGAINST that gradient displaces pixels away from your motion, the way
  // a real disturbance bulges water outward from its source, instead of just tinting/highlighting
  // the area like Reveal does.
  vec2 eps = vec2(0.01, 0.0);
  float tR = sampleTrail(vStagePos + eps.xy);
  float tL = sampleTrail(vStagePos - eps.xy);
  float tU = sampleTrail(vStagePos + eps.yx);
  float tD = sampleTrail(vStagePos - eps.yx);
  vec2 gradient = vec2(tR - tL, tU - tD);

  // Concentric traveling ripple rings: as trail intensity decays after a movement, sin(trail * k)
  // sweeps through its cycle, reading as waves radiating outward and fading rather than a static bulge.
  float ripple = sin(trail * 22.0 - uTime * 4.0) * trail;
  vec2 pushDir = normalize(gradient + vec2(1e-5));
  vec2 displacedStage = vStagePos - gradient * 0.9 - pushDir * ripple * 0.05 * (1.0 + uEnergy * 0.6);

  vec2 localUV = vec2(displacedStage.x / uAspect, displacedStage.y) * 0.5 + 0.5;
  vec2 videoUV = localUV * uVideoRepeat + uVideoOffset;
  vec3 color = texture2D(uVideo, videoUV).rgb;

  if (uHasSelfView > 0.5) {
    // Your live self-view rides the SAME ripple displacement as the imported video, then blends
    // with it — roughly even at baseline so both are always visible melting into one another, tipped
    // further toward your live self right where you've recently moved, so the merge itself feels
    // driven by your motion rather than a fixed static overlay.
    vec2 selfUV = localUV * uSelfViewRepeat + uSelfViewOffset;
    vec3 selfColor = texture2D(uSelfView, selfUV).rgb;
    float blend = clamp(0.5 + (trail - 0.3) * 0.6, 0.15, 0.85);
    color = mix(color, selfColor, blend);
  }

  // A very faint brightening right where the ripple peaks, like light catching a wave crest —
  // subtle enough not to wash the video out even at full trail intensity.
  color += vec3(0.06) * trail;

  color *= (1.0 - uBackdropDim);
  gl_FragColor = vec4(color, 1.0);
}
