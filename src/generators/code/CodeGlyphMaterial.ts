import * as THREE from 'three';
import vertexShader from './codeGlyph.vert.glsl';
import fragmentShader from './codeGlyph.frag.glsl';
import type { GlyphAtlas } from './GlyphAtlas';

/** Instanced digit/code-symbol glyph material, sampled from a baked atlas texture, with the same body-cutout masking as the other reactive modes. */
export class CodeGlyphMaterial extends THREE.ShaderMaterial {
  constructor(palette: THREE.Color[], atlas: GlyphAtlas) {
    const paletteUniform = [0, 1, 2, 3, 4].map((i) => palette[i]?.clone() ?? new THREE.Color(0xffffff));

    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uAtlas: { value: atlas.texture },
        uGridSize: { value: atlas.gridSize },
        uPalette: { value: paletteUniform },
        uAspect: { value: 1 },
        uMask: { value: null as THREE.Texture | null },
        uMaskResolution: { value: new THREE.Vector2(1, 1) },
        uHasMask: { value: 0 },
        uMaskFeather: { value: 0.08 },
        uInvertMask: { value: 1 },
        u3D: { value: 0 },
      },
    });
  }

  /** Live-swaps the baked glyph atlas (e.g. switching Script's language) without rebuilding the mesh. */
  setAtlas(atlas: GlyphAtlas): void {
    this.uniforms.uAtlas.value = atlas.texture;
    this.uniforms.uGridSize.value = atlas.gridSize;
  }

  /** When true, glyphs get a beveled/embossed pseudo-3D shading instead of flat color. */
  set3D(enabled: boolean): void {
    this.uniforms.u3D.value = enabled ? 1 : 0;
  }

  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  /** When true (the "Outside" style), the mask cuts the body OUT as empty space and glyphs swirl
   * around it. When false (the "Inside" style), glyphs instead fill the body silhouette itself. */
  setInvertMask(invert: boolean): void {
    this.uniforms.uInvertMask.value = invert ? 1 : 0;
  }

  setPalette(colors: THREE.Color[]): void {
    const arr = this.uniforms.uPalette.value as THREE.Color[];
    for (let i = 0; i < arr.length; i++) {
      if (colors[i]) arr[i].copy(colors[i]);
    }
  }

  setMask(mask: THREE.Texture | null, width: number, height: number): void {
    this.uniforms.uMask.value = mask;
    (this.uniforms.uMaskResolution.value as THREE.Vector2).set(width, height);
    this.uniforms.uHasMask.value = mask ? 1 : 0;
  }
}
