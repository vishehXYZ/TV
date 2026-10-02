import * as THREE from 'three';
import vertexShader from './pixelMelt.vert.glsl';
import fragmentShader from './pixelMelt.frag.glsl';

/** Fullscreen shader combining chunky movement-driven pixelation (mosaic block quantization, growing blocks as intensity rises) with a warped melt-blur layered on top — the body and image both break into a liquefying mosaic rather than a soft blur. */
export class PixelMeltMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: false,
      depthWrite: true,
      uniforms: {
        uVideo: { value: null as THREE.Texture | null },
        uVideoRepeat: { value: new THREE.Vector2(1, 1) },
        uVideoOffset: { value: new THREE.Vector2(0, 0) },
        uMask: { value: null as THREE.Texture | null },
        uMaskResolution: { value: new THREE.Vector2(1, 1) },
        uHasMask: { value: 0 },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uMeltAmount: { value: 0 },
        uBackdropDim: { value: 0 },
        uPalette: { value: [0, 1, 2, 3, 4].map(() => new THREE.Color(0xffffff)) },
        uPaletteAmount: { value: 0.7 },
      },
    });
  }

  setPalette(colors: THREE.Color[]): void {
    const arr = this.uniforms.uPalette.value as THREE.Color[];
    for (let i = 0; i < arr.length; i++) {
      if (colors[i]) arr[i]!.copy(colors[i]!);
    }
  }

  setVideo(texture: THREE.Texture | null): void {
    this.uniforms.uVideo.value = texture;
  }

  setVideoCover(repeatX: number, repeatY: number, offsetX: number, offsetY: number): void {
    (this.uniforms.uVideoRepeat.value as THREE.Vector2).set(repeatX, repeatY);
    (this.uniforms.uVideoOffset.value as THREE.Vector2).set(offsetX, offsetY);
  }

  setMask(mask: THREE.Texture | null, width: number, height: number): void {
    this.uniforms.uMask.value = mask;
    (this.uniforms.uMaskResolution.value as THREE.Vector2).set(width, height);
    this.uniforms.uHasMask.value = mask ? 1 : 0;
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  setMeltAmount(amount: number): void {
    this.uniforms.uMeltAmount.value = amount;
  }

  setBackdropDim(amount: number): void {
    this.uniforms.uBackdropDim.value = amount;
  }
}
