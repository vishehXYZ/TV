import * as THREE from 'three';
import vertexShader from './chroma.vert.glsl';
import fragmentShader from './chroma.frag.glsl';

export const CHROMA_ANCHOR_COUNT = 6;

/**
 * Colors the body silhouette itself by region — head, hands, torso, legs each pull toward a
 * different palette color, blended smoothly (inverse-distance weighted, not hard zone edges) for an
 * organic thermal-map look, with drifting grain so it reads as alive rather than static gradients.
 */
export class ChromaMaterial extends THREE.ShaderMaterial {
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
        uAnchors: { value: Array.from({ length: CHROMA_ANCHOR_COUNT }, () => new THREE.Vector2()) },
        uAnchorCount: { value: 0 },
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

  setPalette(colors: THREE.Color[]): void {
    const arr = this.uniforms.uPalette.value as THREE.Color[];
    for (let i = 0; i < arr.length; i++) {
      if (colors[i]) arr[i]!.copy(colors[i]!);
    }
  }

  setAnchors(anchors: THREE.Vector2[]): void {
    const arr = this.uniforms.uAnchors.value as THREE.Vector2[];
    for (let i = 0; i < CHROMA_ANCHOR_COUNT; i++) {
      if (i < anchors.length) arr[i]!.copy(anchors[i]!);
      else arr[i]!.set(0, 0);
    }
    this.uniforms.uAnchorCount.value = Math.min(anchors.length, CHROMA_ANCHOR_COUNT);
  }

  setMask(mask: THREE.Texture | null, width: number, height: number): void {
    this.uniforms.uMask.value = mask;
    (this.uniforms.uMaskResolution.value as THREE.Vector2).set(width, height);
    this.uniforms.uHasMask.value = mask ? 1 : 0;
  }
}
