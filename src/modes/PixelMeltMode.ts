import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import type { BackgroundLayer } from '../core/BackgroundLayer';
import { PixelMeltMaterial } from '../generators/pixelmelt/PixelMeltMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/** How quickly the effect amount eases toward its movement-driven target — larger = slower, softer ramps in and out. */
const MELT_SMOOTH_SECONDS = 0.6;

/**
 * Powers Glitch mode's "Pixelated" style — whatever background is active
 * breaks into a mosaic of movement-sized blocks with bold grid lines, and a
 * subset of rows randomly jitter/displace with a slight RGB channel split
 * on a stepped clock, reading as digital block-glitch rather than a melt/
 * liquefy warp. Spreads across the whole image rather than staying tightly
 * clipped to the silhouette. With no background selected there's nothing to
 * affect, so the mode stays hidden.
 */
export class PixelMeltMode {
  readonly mesh: THREE.Mesh;
  readonly material: PixelMeltMaterial;

  private sceneManager: SceneManager;
  private videoEl: HTMLVideoElement;
  private backgroundLayer: BackgroundLayer;
  private maskTexture = new SegmentationMaskTexture();
  private meltAmount = 0;

  constructor(sceneManager: SceneManager, videoEl: HTMLVideoElement, backgroundLayer: BackgroundLayer) {
    this.sceneManager = sceneManager;
    this.videoEl = videoEl;
    this.backgroundLayer = backgroundLayer;
    this.material = new PixelMeltMaterial();

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -0.95;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
    if (visible && this.backgroundLayer.mode === 'none') {
      this.backgroundLayer.setCamera(this.videoEl);
    }
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, dt: number): void {
    const texture = this.backgroundLayer.getTexture();
    if (!this.backgroundLayer.mesh.visible || !texture) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const aspect = this.sceneManager.aspect;
    this.mesh.scale.set(aspect, 1, 1);
    this.material.setAspect(aspect);
    this.material.setTime(elapsedSeconds);
    this.material.setVideo(texture);
    this.material.setVideoCover(texture.repeat.x, texture.repeat.y, texture.offset.x, texture.offset.y);
    this.material.setBackdropDim(this.backgroundLayer.getDim());
    this.material.setPalette(appState.palette);

    const state = poseTracker.state;
    const maskTex = this.maskTexture.update(state);
    this.material.setMask(maskTex, this.maskTexture.width, this.maskTexture.height);

    const target = THREE.MathUtils.clamp(state.energy * 4, 0, 1);
    if (dt > 0.0001) {
      this.meltAmount += (target - this.meltAmount) * (1 - Math.exp(-dt / MELT_SMOOTH_SECONDS));
    }
    this.material.setMeltAmount(this.meltAmount);
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.maskTexture.dispose();
  }
}
