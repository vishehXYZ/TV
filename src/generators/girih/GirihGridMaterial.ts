import * as THREE from 'three';
import vertexShader from './girih.vert.glsl';
import fragmentShader from './girih.frag.glsl';

export interface GirihParams {
  density: number;
  symmetry: number;
  sharpness: number;
  innerRatio: number;
  strokeWidth: number;
  warpStrength: number;
  maskFeather: number;
}

export const DEFAULT_GIRIH_PARAMS: GirihParams = {
  density: 6,
  symmetry: 8,
  sharpness: 2.2,
  innerRatio: 0.42,
  strokeWidth: 0.05,
  warpStrength: 3.0,
  maskFeather: 0.08,
};

export const MAX_BONES = 12;

/** Fullscreen star-tessellation ("girih") ShaderMaterial, reused across all three visual modes. */
export class GirihGridMaterial extends THREE.ShaderMaterial {
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
        uAspect: { value: 1 },
        uDensity: { value: DEFAULT_GIRIH_PARAMS.density },
        uSymmetry: { value: DEFAULT_GIRIH_PARAMS.symmetry },
        uSharpness: { value: DEFAULT_GIRIH_PARAMS.sharpness },
        uInnerRatio: { value: DEFAULT_GIRIH_PARAMS.innerRatio },
        uStrokeWidth: { value: DEFAULT_GIRIH_PARAMS.strokeWidth },
        uPalette: { value: paletteUniform },
        uMask: { value: null as THREE.Texture | null },
        uMaskResolution: { value: new THREE.Vector2(1, 1) },
        uHasMask: { value: 0 },
        uMaskFeather: { value: DEFAULT_GIRIH_PARAMS.maskFeather },
        uBones: { value: Array.from({ length: MAX_BONES }, () => new THREE.Vector4()) },
        uBoneCount: { value: 0 },
        uWarpStrength: { value: DEFAULT_GIRIH_PARAMS.warpStrength },
        uEnergy: { value: 0 },
        uOpacity: { value: 1 },
      },
    });
  }

  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  setEnergy(energy: number): void {
    this.uniforms.uEnergy.value = energy;
  }

  setOpacity(opacity: number): void {
    this.uniforms.uOpacity.value = opacity;
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  setParams(params: Partial<GirihParams>): void {
    if (params.density !== undefined) this.uniforms.uDensity.value = params.density;
    if (params.symmetry !== undefined) this.uniforms.uSymmetry.value = params.symmetry;
    if (params.sharpness !== undefined) this.uniforms.uSharpness.value = params.sharpness;
    if (params.innerRatio !== undefined) this.uniforms.uInnerRatio.value = params.innerRatio;
    if (params.strokeWidth !== undefined) this.uniforms.uStrokeWidth.value = params.strokeWidth;
    if (params.warpStrength !== undefined) this.uniforms.uWarpStrength.value = params.warpStrength;
    if (params.maskFeather !== undefined) this.uniforms.uMaskFeather.value = params.maskFeather;
  }

  setPalette(colors: THREE.Color[]): void {
    const arr = this.uniforms.uPalette.value as THREE.Color[];
    for (let i = 0; i < arr.length; i++) {
      if (colors[i]) arr[i].copy(colors[i]);
    }
  }

  setBones(bones: THREE.Vector4[]): void {
    const arr = this.uniforms.uBones.value as THREE.Vector4[];
    for (let i = 0; i < MAX_BONES; i++) {
      if (i < bones.length) arr[i].copy(bones[i]);
      else arr[i].set(0, 0, 0, 0);
    }
    this.uniforms.uBoneCount.value = Math.min(bones.length, MAX_BONES);
  }

  setMask(mask: THREE.Texture | null, width: number, height: number): void {
    this.uniforms.uMask.value = mask;
    (this.uniforms.uMaskResolution.value as THREE.Vector2).set(width, height);
    this.uniforms.uHasMask.value = mask ? 1 : 0;
  }
}
