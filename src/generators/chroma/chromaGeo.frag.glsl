uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uAspect;

uniform float uTime;
uniform vec3 uPalette[5];
/** Six body-region anchors in stage space (head, left hand, right hand, torso, left leg, right leg) — see ChromaGeoMode.ts. */
uniform vec2 uAnchors[6];
uniform float uAnchorCount;
uniform float uEnergy;

varying vec2 vStagePos;

#include ../shared/maskSample.glsl;
#include ../shared/paletteGradient.glsl;
#include ../shared/simplexNoise.glsl;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

/** Same inverse-distance-weighted anchor blend Marble/Liquid uses, factored out here because the
 * geometric variant below samples it once per facet (at that facet's own center) rather than once
 * per fragment — that's the entire difference between a smooth liquid blend and flat polygon cells. */
vec3 regionColor(vec2 p) {
  vec3 color = vec3(0.0);
  float totalWeight = 0.0;
  int count = int(uAnchorCount);
  for (int i = 0; i < 6; i++) {
    if (i >= count) break;
    float d = distance(p, uAnchors[i]);
    float weight = 1.0 / (d * d * 1.1 + 0.05);
    color += paletteColor(float(i) / 5.0) * weight;
    totalWeight += weight;
  }
  return color / max(totalWeight, 0.0001);
}

void main() {
  float bodyVal = uHasMask > 0.5 ? sampleMask(vStagePos) : 0.0;
  float alpha = smoothstep(0.35, 0.65, bodyVal);
  if (alpha < 0.01) discard;

  // Same slow domain warp as Liquid (much gentler here) so facet colors still drift with body
  // movement instead of sitting on a dead-static grid.
  vec2 warp1 = vec2(
    snoise(vStagePos * 1.4 + uTime * 0.15),
    snoise(vStagePos * 1.4 + uTime * 0.12 + 40.0)
  );
  vec2 meltPos = vStagePos + warp1 * 0.3;

  // Cheap jittered-grid Voronoi: each fragment finds its nearest and second-nearest cell point: the
  // gap between those two distances (the standard "F2 - F1" cellular-noise trick) isolates a thin
  // seam right at each facet's border, which is what actually reads as "cut" edges between polygons.
  float cellScale = 8.0;
  vec2 gp = meltPos * cellScale;
  vec2 baseCell = floor(gp);
  vec2 localP = fract(gp);
  float minDist1 = 8.0;
  float minDist2 = 8.0;
  vec2 closestPoint = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellId = baseCell + neighbor;
      vec2 jitter = vec2(hash21(cellId), hash21(cellId + 91.7));
      vec2 pointPos = neighbor + jitter;
      float d = length(pointPos - localP);
      if (d < minDist1) {
        minDist2 = minDist1;
        minDist1 = d;
        closestPoint = (cellId + jitter) / cellScale;
      } else if (d < minDist2) {
        minDist2 = d;
      }
    }
  }
  float edge = minDist2 - minDist1;

  // Flat per-facet color: every fragment inside a cell reads the SAME point (that cell's own
  // jittered center), so the whole facet renders as one flat polygon of color instead of a smooth
  // gradient — the defining trait of a faceted/low-poly surface, in contrast to Liquid's continuous
  // per-fragment blend.
  vec3 color = regionColor(closestPoint);

  // Per-facet brightness variation, like light catching each cut at a slightly different angle.
  float facetShade = 0.8 + hash21(closestPoint * 37.0) * 0.4;
  color *= facetShade;

  // Dark seam lines right at facet borders — the stained-glass/cut-gem "leading" between cells.
  float seam = 1.0 - smoothstep(0.0, 0.05, edge);
  color *= 1.0 - seam * 0.6;

  color *= 1.0 + min(uEnergy, 1.2) * 0.12;

  // Same brightness-preserving safety net as Liquid — scale down by the brightest channel rather
  // than clamp, so a hot facet dims smoothly instead of blowing one channel out to solid white.
  float maxChannel = max(color.r, max(color.g, color.b));
  if (maxChannel > 1.0) color /= maxChannel;

  gl_FragColor = vec4(color, alpha);
}
