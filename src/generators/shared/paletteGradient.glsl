/** Samples a 5-stop palette (uPalette uniform must be declared by the including file). */
vec3 paletteColor(float t) {
  t = clamp(t, 0.0, 1.0);
  float scaled = t * 4.0;
  int idx = int(floor(scaled));
  idx = clamp(idx, 0, 3);
  float frac = scaled - float(idx);
  return mix(uPalette[idx], uPalette[idx + 1], frac);
}
