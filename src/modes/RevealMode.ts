import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import type { BackgroundLayer } from '../core/BackgroundLayer';
import { RevealMaterial } from '../generators/reveal/RevealMaterial';
import { PaintTrail } from '../generators/abstract/PaintTrail';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/**
 * Mode "Reveal" — whatever background is active (an uploaded image, an uploaded video, or the live
 * camera) stays hidden behind a faint ghost of itself. Your exact current body silhouette reveals it
 * in full, with a decaying trail lingering a moment after you've moved on so it still reads as
 * motion painting the video into view rather than a static cutout. With no background selected
 * there's nothing to reveal, so the mode stays hidden.
 */
export class RevealMode {
  readonly mesh: THREE.Mesh;
  readonly material: RevealMaterial;

  private sceneManager: SceneManager;
  private videoEl: HTMLVideoElement;
  private backgroundLayer: BackgroundLayer;
  private paintTrail = new PaintTrail();
  private maskTexture = new SegmentationMaskTexture();

  constructor(sceneManager: SceneManager, videoEl: HTMLVideoElement, backgroundLayer: BackgroundLayer) {
    this.sceneManager = sceneManager;
    this.videoEl = videoEl;
    this.backgroundLayer = backgroundLayer;
    this.material = new RevealMaterial();

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

  update(poseTracker: PoseTracker, _appState: AppState, _elapsedSeconds: number, dt: number): void {
    const texture = this.backgroundLayer.getTexture();
    if (!this.backgroundLayer.mesh.visible || !texture) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    const aspect = this.sceneManager.aspect;
    this.mesh.scale.set(aspect, 1, 1);
    this.material.setAspect(aspect);
    this.material.setVideo(texture);
    this.material.setVideoCover(texture.repeat.x, texture.repeat.y, texture.offset.x, texture.offset.y);
    this.material.setBackdropDim(this.backgroundLayer.getDim());

    this.paintTrail.update(poseTracker, this.sceneManager, dt);
    this.material.setTrail(this.paintTrail.getTexture());

    const maskTex = this.maskTexture.update(poseTracker.state);
    this.material.setMask(maskTex, this.maskTexture.width, this.maskTexture.height);
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.paintTrail.dispose();
    this.maskTexture.dispose();
  }
}
