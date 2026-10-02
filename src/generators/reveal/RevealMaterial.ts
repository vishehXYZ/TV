import * as THREE from 'three';
import vertexShader from './reveal.vert.glsl';
import fragmentShader from './reveal.frag.glsl';

/**
 * Mode "Reveal" — the imported video/image stays hidden behind a faint ghost of itself, and your
 * exact current body silhouette reveals it in full, with a decaying trail lingering a moment after
 * you've moved on (the same paint-trail field Abstract Grow uses).
 */
export class RevealMaterial extends THREE.ShaderMaterial {
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
        uAspect: { value: 1 },
        uBackdropDim: { value: 0 },
        uTrail: { value: null as THREE.Texture | null },
        uMask: { value: null as THREE.Texture | null },
        uMaskResolution: { value: new THREE.Vector2(1, 1) },
        uHasMask: { value: 0 },
      },
    });
  }

  setMask(mask: THREE.Texture | null, width: number, height: number): void {
    this.uniforms.uMask.value = mask;
    (this.uniforms.uMaskResolution.value as THREE.Vector2).set(width, height);
    this.uniforms.uHasMask.value = mask ? 1 : 0;
  }

  setVideo(texture: THREE.Texture | null): void {
    this.uniforms.uVideo.value = texture;
  }

  setVideoCover(repeatX: number, repeatY: number, offsetX: number, offsetY: number): void {
    (this.uniforms.uVideoRepeat.value as THREE.Vector2).set(repeatX, repeatY);
    (this.uniforms.uVideoOffset.value as THREE.Vector2).set(offsetX, offsetY);
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  setBackdropDim(amount: number): void {
    this.uniforms.uBackdropDim.value = amount;
  }

  setTrail(trail: THREE.Texture): void {
    this.uniforms.uTrail.value = trail;
  }
}
