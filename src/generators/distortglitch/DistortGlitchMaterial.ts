import * as THREE from 'three';
import vertexShader from './distortGlitch.vert.glsl';
import fragmentShader from './distortGlitch.frag.glsl';

/** Fullscreen live-camera distortion shader: continuous wavy line displacement, a soft chromatic fringe riding the wave, fine animated film-grain noise, and occasional full-width tears — an analog-signal-interference cousin of the blocky pixel/static Glitch mode. */
export class DistortGlitchMaterial extends THREE.ShaderMaterial {
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
        uGlitchAmount: { value: 0 },
        uBackdropDim: { value: 0 },
        uPalette: { value: [0, 1, 2, 3, 4].map(() => new THREE.Color(0xffffff)) },
        uPaletteAmount: { value: 0.6 },
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

  setGlitchAmount(amount: number): void {
    this.uniforms.uGlitchAmount.value = amount;
  }

  setBackdropDim(amount: number): void {
    this.uniforms.uBackdropDim.value = amount;
  }
}
