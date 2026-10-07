import * as THREE from 'three';
import { DEFAULT_GIRIH_PARAMS, type GirihParams } from '../generators/girih/GirihGridMaterial';
import { DEFAULT_ABSTRACT_PARAMS, type AbstractParams } from '../generators/abstract/AbstractMaterial';
import { DEFAULT_SKETCH_PARAMS, type SketchParams } from '../generators/sketch/SketchMaterial';
import type { GlyphSet } from '../generators/code/GlyphAtlas';

export interface PalettePreset {
  name: string;
  colors: string[];
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { name: 'Lapis & Gold', colors: ['#0b1f4d', '#1c4fa1', '#3f7fd1', '#e8c25a', '#f5e6b8'] },
  { name: 'Emerald Kufic', colors: ['#04211a', '#0d5c46', '#1f9c72', '#d8b45a', '#f1e2b0'] },
  { name: 'Ivory & Ink', colors: ['#141414', '#3a3a3a', '#8a8a8a', '#d8cbb0', '#f5efe0'] },
  { name: 'Rose & Turquoise', colors: ['#3a0d24', '#8c1f52', '#1f8c8c', '#e07a9e', '#f3d9c4'] },
  { name: 'Sunset Ember', colors: ['#2b0a0a', '#8c1f1f', '#d1541f', '#f0a13a', '#ffe3b0'] },
  { name: 'Neon Cyberpunk', colors: ['#0a0018', '#4b0e8f', '#c026d3', '#ff5ec4', '#8ff4ff'] },
  { name: 'Arctic Frost', colors: ['#0a1a2b', '#144766', '#2f8fb0', '#8fd6e8', '#eef9ff'] },
  { name: 'Desert Dune', colors: ['#2b1708', '#6b3d1a', '#b06a2e', '#e0a862', '#f6ddb0'] },
  { name: 'Royal Amethyst', colors: ['#1a0a2b', '#4a1266', '#8c2fb0', '#c47fe0', '#f0d9ff'] },
  { name: 'Forest Moss', colors: ['#0d1f0f', '#1f4a24', '#4a8c4f', '#a3c97a', '#e8f0c8'] },
  { name: 'Midnight Violet', colors: ['#05041a', '#1a1350', '#3d2a8c', '#7a5fd1', '#c9baf0'] },
  { name: 'Coral Reef', colors: ['#04262b', '#0d6b6e', '#2fb0a3', '#6fe0c4', '#d4fff0'] },
];

export type VisualMode =
  | 'fill'
  | 'dance'
  | 'nature'
  | 'code'
  | 'codeInside'
  | 'script'
  | 'scriptInside'
  | 'lightning'
  | 'abstractFill'
  | 'abstractGrow'
  | 'dissolve'
  | 'dissolveLines'
  | 'mandala'
  | 'pixelMelt'
  | 'glitch'
  | 'glitchMono'
  | 'glitchLines'
  | 'distortGlitch'
  | 'chroma'
  | 'chromaGeo'
  | 'sketch'
  | 'ripple'
  | 'reveal'
  | 'verticalLines'
  | 'scribbleGlitch'
  | 'numberGlitch'
  | 'chaosMix'
  | 'dualTexture'
  | 'dualTextureReverse';

export class AppState {
  mode: VisualMode = 'fill';
  chaos = { density: 1, speed: 1, glitch: 0.65, usePalette: false };
  paletteName: string = PALETTE_PRESETS[0]!.name;
  palette: THREE.Color[] = PALETTE_PRESETS[0]!.colors.map((c) => new THREE.Color(c));
  girih: GirihParams = { ...DEFAULT_GIRIH_PARAMS };
  abstract: AbstractParams = { ...DEFAULT_ABSTRACT_PARAMS };
  sketch: SketchParams = { ...DEFAULT_SKETCH_PARAMS };
  /** Only affects Script (not Code) — which letterform set its glyphs are baked from. */
  scriptLanguage: GlyphSet = 'arabic';
  /** Only affects Script (not Code) — beveled/embossed pseudo-3D glyph shading. */
  script3D = false;

  setPreset(name: string): void {
    const preset = PALETTE_PRESETS.find((p) => p.name === name);
    if (!preset) return;
    this.paletteName = name;
    this.palette = preset.colors.map((c) => new THREE.Color(c));
  }

  setCustomColor(index: number, hex: string): void {
    if (!this.palette[index]) return;
    this.palette[index].set(hex);
    this.paletteName = 'Custom';
  }
}
