import * as THREE from 'three';
import vertexShader from './dissolveParticle.vert.glsl';
import fragmentShader from './dissolveParticle.frag.glsl';

/**
 * Soft, organic "jellyfish / wave-foam" blob material with per-instance
 * color (sampled from the live video, not a fixed palette) and per-instance
 * fade alpha. Uses normal alpha blending (not additive) so dark-colored
 * blobs actually cover/replace what's beneath them instead of vanishing —
 * additive blending would make a black jacket piece contribute nothing and
 * let the sharp video show straight through, which defeats the dissolve look.
 */
export class DissolveMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
      },
    });
  }

  setTime(t: number): void {
    this.uniforms.uTime!.value = t;
  }
}
