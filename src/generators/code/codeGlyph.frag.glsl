uniform sampler2D uAtlas;
uniform float uGridSize;
uniform vec3 uPalette[5];
uniform float uTime;
uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uHasMask;
uniform float uMaskFeather;
uniform float uAspect;
uniform float uInvertMask;
uniform float u3D;

varying vec2 vUv;
varying float vSeed;
varying vec2 vWorldPos;
varying float vGlyphIndex;

#include ../shared/paletteGradient.glsl;
#include ../shared/maskSample.glsl;

vec3 hsv2rgb(vec3 c) {
  vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
  return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
}

/** A curated set of saturated "pop" plastics — hot pink, Benetton green, electric blue, tangerine,
 * violet, pop yellow — instead of a smooth rainbow gradient, for a Memphis/Karim-Rashid candy-plastic
 * read rather than a generic hue wheel. */
vec3 popColor(float idx) {
  float i = mod(idx, 6.0);
  if (i < 0.5) return vec3(1.0, 0.08, 0.58);
  if (i < 1.5) return vec3(0.0, 0.85, 0.45);
  if (i < 2.5) return vec3(0.05, 0.65, 1.0);
  if (i < 3.5) return vec3(1.0, 0.55, 0.0);
  if (i < 4.5) return vec3(0.75, 0.15, 1.0);
  return vec3(1.0, 0.85, 0.0);
}

void main() {
  float gi = floor(vGlyphIndex + 0.5);
  float col = mod(gi, uGridSize);
  float row = floor(gi / uGridSize);
  vec2 cellUv = (vec2(col, row) + vUv) / uGridSize;
  // Alpha is the original plain antialiased glyph coverage — exactly what the flat/non-3D style has
  // always used. The 3D style separately reads a baked signed-distance field from the RED channel
  // (0 = well outside a stroke, 0.5 = right at its edge, 1 = deep interior) — see
  // GlyphAtlas.ts's bakeSDFChannel — so switching to 3D can't change the flat style's letter edges.
  float glyphAlpha = texture2D(uAtlas, cellUv).a;

  vec3 baseColor = paletteColor(fract(vSeed * 1.7 + uTime * 0.05));
  vec3 glow = mix(baseColor, vec3(1.5, 1.9, 1.6), 0.55);
  vec3 color = mix(baseColor, glow, 0.6);

  if (u3D > 0.5) {
    float sdf = texture2D(uAtlas, cellUv).r;
    // Thresholding the SDF well below its own edge (0.5) visually fattens each stroke into a bold,
    // puffy "balloon letter" silhouette instead of the thinner flat glyph shape.
    float bold = smoothstep(0.2, 0.38, sdf);

    // Pop plastic: each of the 16 baked glyph slots cycles through 6 curated candy colors (not the
    // app's usual muted palette, and not a smooth rainbow either — distinct punchy hues like hot pink
    // and Benetton green). Kept dimmed under the app's bloom threshold (0.72) so the letter's FACE
    // stays a flat, solid, readable color instead of blooming into a washed-out haze — only the
    // deliberate highlights below are allowed to cross that threshold, which is what makes them read
    // as glossy sparkle rather than everything glowing uniformly.
    color = popColor(gi) * 0.8;

    // A smooth gradient of the SDF (much cleaner than the raw antialiased mask's noisy edge) stands
    // in for a rounded surface normal — steep near the boundary, flattening out toward the interior —
    // producing a genuinely domed/inflated volume rather than a thin rim of shading at the edge only.
    float eps = 0.02;
    float sR = texture2D(uAtlas, cellUv + vec2(eps, 0.0)).r;
    float sL = texture2D(uAtlas, cellUv - vec2(eps, 0.0)).r;
    float sU = texture2D(uAtlas, cellUv + vec2(0.0, eps)).r;
    float sD = texture2D(uAtlas, cellUv - vec2(0.0, eps)).r;
    vec2 grad = vec2(sR - sL, sU - sD);
    float depth = smoothstep(0.2, 1.0, sdf);
    vec3 normal = normalize(vec3(-grad * 7.0, mix(0.25, 1.0, depth)));
    vec3 lightDir = normalize(vec3(-0.45, 0.6, 0.65));
    float diff = dot(normal, lightDir) * 0.5 + 0.5;
    // Only darkens the shadow side (max multiplier stays at 1.0) — this is what gives the puffy round
    // volume its shape without pushing the whole face over the bloom threshold.
    color *= mix(0.45, 1.0, diff);

    // Glass, not plastic: a bright fresnel-style rim right at the boundary — light catching a curved
    // translucent edge — instead of a dark outline, plus a tight, sharp specular highlight and a
    // smaller secondary sparkle for a genuinely glossy/wet-glass read. These are the ONLY parts of the
    // letter deliberately pushed bright enough to bloom, so the sparkle reads as a distinct glassy pop
    // against an otherwise solid, flat-colored face.
    float fresnel = pow(1.0 - depth, 3.0);
    color += vec3(0.9, 0.95, 1.0) * fresnel * 0.4;
    float shine = smoothstep(0.2, 0.0, distance(vUv, vec2(0.3, 0.68))) * depth;
    color += vec3(1.0) * shine * 1.1;
    float sparkle = smoothstep(0.07, 0.0, distance(vUv, vec2(0.62, 0.32))) * depth;
    color += vec3(1.0) * sparkle * 0.8;

    // A hairline-thin dark edge right at the true silhouette boundary, just enough to keep the shape
    // crisply readable without reading as a heavy outline.
    float edgeLine = (1.0 - smoothstep(0.36, 0.4, sdf)) * smoothstep(0.3, 0.36, sdf);
    color *= mix(1.0, 0.4, edgeLine);

    glyphAlpha = bold;
  }

  float alpha = glyphAlpha;

  if (uHasMask > 0.5) {
    float bodyVal = sampleMask(vWorldPos);
    float bodyAlpha = smoothstep(0.5 - uMaskFeather, 0.5 + uMaskFeather, bodyVal);
    float outsideBody = mix(bodyAlpha, 1.0 - bodyAlpha, uInvertMask);
    alpha *= outsideBody;
  }

  if (alpha < 0.05) discard;
  gl_FragColor = vec4(color, alpha);
}
