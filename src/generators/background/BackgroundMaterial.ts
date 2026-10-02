import * as THREE from 'three';
import vertexShader from './background.vert.glsl';
import fragmentShader from './background.frag.glsl';

/** Live camera / uploaded image / uploaded video, with brightness/contrast/saturation grading on
 * top of the existing opacity + Light/Dark backdrop dim — replaces a plain MeshBasicMaterial so
 * uploaded media can actually be color-graded to taste instead of playing back exactly as shot. */
export class BackgroundMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: true,
      toneMapped: false,
      uniforms: {
        uMap: { value: null as THREE.Texture | null },
        uHasMap: { value: 0 },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uOpacity: { value: 1 },
        uDim: { value: 0 },
        uBrightness: { value: 1 },
        uContrast: { value: 1 },
        uSaturation: { value: 1 },
      },
    });
  }

  setMap(texture: THREE.Texture | null): void {
    this.uniforms.uMap.value = texture;
    this.uniforms.uHasMap.value = texture ? 1 : 0;
  }

  setRepeatOffset(repeatX: number, repeatY: number, offsetX: number, offsetY: number): void {
    (this.uniforms.uRepeat.value as THREE.Vector2).set(repeatX, repeatY);
    (this.uniforms.uOffset.value as THREE.Vector2).set(offsetX, offsetY);
  }

  setOpacity(opacity: number): void {
    this.uniforms.uOpacity.value = opacity;
  }

  setDim(dim: number): void {
    this.uniforms.uDim.value = dim;
  }

  /** 1 = unchanged, <1 darker, >1 brighter. */
  setBrightness(value: number): void {
    this.uniforms.uBrightness.value = value;
  }

  /** 1 = unchanged, <1 flatter/lower contrast, >1 punchier. */
  setContrast(value: number): void {
    this.uniforms.uContrast.value = value;
  }

  /** 1 = unchanged, 0 = grayscale, >1 more vivid. */
  setSaturation(value: number): void {
    this.uniforms.uSaturation.value = value;
  }
}
