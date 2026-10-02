import * as THREE from 'three';
import vertexShader from './ripple.vert.glsl';
import fragmentShader from './ripple.frag.glsl';

/**
 * Mode "Ripple" — the imported video/image and your own live self-view both ride the same
 * movement-driven ripple displacement and blend together, so it reads as you and the imported
 * content melting into one another rather than either one alone warping in isolation. Driven by the
 * same decaying paint-trail field Abstract Grow's reveal uses, not a fixed full-frame wobble.
 */
export class RippleMaterial extends THREE.ShaderMaterial {
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
        uSelfView: { value: null as THREE.Texture | null },
        uSelfViewRepeat: { value: new THREE.Vector2(1, 1) },
        uSelfViewOffset: { value: new THREE.Vector2(0, 0) },
        uHasSelfView: { value: 0 },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uBackdropDim: { value: 0 },
        uTrail: { value: null as THREE.Texture | null },
      },
    });
  }

  setVideo(texture: THREE.Texture | null): void {
    this.uniforms.uVideo.value = texture;
  }

  setVideoCover(repeatX: number, repeatY: number, offsetX: number, offsetY: number): void {
    (this.uniforms.uVideoRepeat.value as THREE.Vector2).set(repeatX, repeatY);
    (this.uniforms.uVideoOffset.value as THREE.Vector2).set(offsetX, offsetY);
  }

  setSelfView(texture: THREE.Texture | null): void {
    this.uniforms.uSelfView.value = texture;
    this.uniforms.uHasSelfView.value = texture ? 1 : 0;
  }

  setSelfViewCover(repeatX: number, repeatY: number, offsetX: number, offsetY: number): void {
    (this.uniforms.uSelfViewRepeat.value as THREE.Vector2).set(repeatX, repeatY);
    (this.uniforms.uSelfViewOffset.value as THREE.Vector2).set(offsetX, offsetY);
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  setEnergy(energy: number): void {
    this.uniforms.uEnergy.value = energy;
  }

  setBackdropDim(amount: number): void {
    this.uniforms.uBackdropDim.value = amount;
  }

  setTrail(trail: THREE.Texture): void {
    this.uniforms.uTrail.value = trail;
  }
}
