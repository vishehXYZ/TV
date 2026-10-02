import * as THREE from 'three';
import type { PoseState } from './PoseState';

/** Wraps the latest segmentation mask as a reusable THREE.DataTexture, shared across modes that clip to the body silhouette. */
export class SegmentationMaskTexture {
  texture: THREE.DataTexture | null = null;

  update(state: PoseState): THREE.DataTexture | null {
    const mask = state.segmentationMask;
    if (!mask) return null;

    if (!this.texture || this.texture.image.width !== mask.width || this.texture.image.height !== mask.height) {
      this.texture?.dispose();
      this.texture = new THREE.DataTexture(mask.data, mask.width, mask.height, THREE.RedFormat, THREE.FloatType);
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.flipY = true;
    } else {
      this.texture.image.data = mask.data;
    }
    this.texture.needsUpdate = true;
    return this.texture;
  }

  get width(): number {
    return this.texture?.image.width ?? 1;
  }

  get height(): number {
    return this.texture?.image.height ?? 1;
  }

  dispose(): void {
    this.texture?.dispose();
    this.texture = null;
  }
}
