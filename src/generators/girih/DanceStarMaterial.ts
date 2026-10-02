import * as THREE from 'three';
import vertexShader from './danceStar.vert.glsl';
import fragmentShader from './danceStar.frag.glsl';

/** Small instanced star SDF material, shared by Dance-mode particles and Bloom-mode blossoms. Shape (symmetry/innerRatio/sharpness) varies per instance via attributes for motif variety. */
export class DanceStarMaterial extends THREE.ShaderMaterial {
  constructor(palette: THREE.Color[]) {
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
        uStrokeWidth: { value: 0.06 },
        uPalette: { value: paletteUniform },
        uAspect: { value: 1 },
        uMask: { value: null as THREE.Texture | null },
        uMaskResolution: { value: new THREE.Vector2(1, 1) },
        uHasMask: { value: 0 },
        uMaskFeather: { value: 0.08 },
        uInvertMask: { value: 0 },
      },
    });
  }

  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  /** When true, the mask cuts the body OUT as empty space instead of clipping to it. */
  setInvertMask(invert: boolean): void {
    this.uniforms.uInvertMask.value = invert ? 1 : 0;
  }

  setStrokeWidth(width: number): void {
    this.uniforms.uStrokeWidth.value = width;
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

/** Authentic Islamic geometric symmetry orders (hexagonal/octagonal/decagonal/dodecagonal). */
export const ISLAMIC_SYMMETRIES = [6, 8, 10, 12];

export interface MotifVarietyOptions {
  /** Extra higher-order symmetries mixed into the pool for more intricate motifs (e.g. Astrix's sparks), without changing the default set used elsewhere (e.g. Luns). */
  extraSymmetries?: number[];
  /** Overrides the default [1.0, 4.5] sharpness range. */
  sharpnessRange?: [number, number];
}

/** Fills per-instance shape-variety attributes (symmetry/innerRatio/sharpness) onto instanced geometry. */
export function addMotifVarietyAttributes(
  geometry: THREE.BufferGeometry,
  count: number,
  rng: () => number = Math.random,
  options: MotifVarietyOptions = {},
): void {
  const symmetryPool = options.extraSymmetries ? [...ISLAMIC_SYMMETRIES, ...options.extraSymmetries] : ISLAMIC_SYMMETRIES;
  const [sharpMin, sharpMax] = options.sharpnessRange ?? [1.0, 4.5];
  const symmetry = new Float32Array(count);
  const innerRatio = new Float32Array(count);
  const sharpness = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    symmetry[i] = symmetryPool[Math.floor(rng() * symmetryPool.length)]!;
    innerRatio[i] = 0.2 + rng() * 0.6;
    sharpness[i] = sharpMin + rng() * (sharpMax - sharpMin);
  }
  geometry.setAttribute('aSymmetry', new THREE.InstancedBufferAttribute(symmetry, 1));
  geometry.setAttribute('aInnerRatio', new THREE.InstancedBufferAttribute(innerRatio, 1));
  geometry.setAttribute('aSharpness', new THREE.InstancedBufferAttribute(sharpness, 1));
}
