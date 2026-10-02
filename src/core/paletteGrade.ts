import * as THREE from 'three';

/** CPU-side equivalent of the shader's paletteColor() (see generators/shared/paletteGradient.glsl) — samples a 5-stop palette gradient by position t (0..1). */
export function paletteColorAt(t: number, palette: THREE.Color[], out: THREE.Color): THREE.Color {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * 4;
  const idx = Math.min(3, Math.floor(scaled));
  const frac = scaled - idx;
  out.copy(palette[idx]!).lerp(palette[idx + 1]!, frac);
  return out;
}
