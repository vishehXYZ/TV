import * as THREE from 'three';
import vertexShader from './sketch.vert.glsl';
import fragmentShader from './sketch.frag.glsl';

export interface SketchParams {
  /** Multiplier on the traced outline's width — 1 is the default stroke, lower is a finer line,
   * higher is bolder. */
  lineThickness: number;
}

export const DEFAULT_SKETCH_PARAMS: SketchParams = {
  lineThickness: 1,
};

/**
 * Traces your body's silhouette as several overlapping, independently-jittered contour strokes,
 * each redrawn on its own stepped clock rather than smoothly — the classic hand-drawn animation
 * "boil," where every retraced line differs slightly from the last. Nothing renders except right at
 * the outline itself; the rest of the frame stays transparent.
 */
export class SketchMaterial extends THREE.ShaderMaterial {
  constructor(palette: THREE.Color[]) {
    const paletteUniform = [0, 1, 2, 3, 4].map((i) => palette[i]?.clone() ?? new THREE.Color(0xffffff));

    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPalette: { value: paletteUniform },
        uEnergy: { value: 0 },
        uLineThickness: { value: DEFAULT_SKETCH_PARAMS.lineThickness },
        uMask: { value: null as THREE.Texture | null },
        uMaskResolution: { value: new THREE.Vector2(1, 1) },
        uHasMask: { value: 0 },
      },
    });
  }

  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  setEnergy(energy: number): void {
    this.uniforms.uEnergy.value = energy;
  }

  setLineThickness(thickness: number): void {
    this.uniforms.uLineThickness.value = thickness;
  }

  setPalette(colors: THREE.Color[]): void {
    const arr = this.uniforms.uPalette.value as THREE.Color[];
    for (let i = 0; i < arr.length; i++) {
      if (colors[i]) arr[i]!.copy(colors[i]!);
    }
  }

  setMask(mask: THREE.Texture | null, width: number, height: number): void {
    this.uniforms.uMask.value = mask;
    (this.uniforms.uMaskResolution.value as THREE.Vector2).set(width, height);
    this.uniforms.uHasMask.value = mask ? 1 : 0;
  }
}
