import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import type { BackgroundLayer } from '../core/BackgroundLayer';
import { RippleMaterial } from '../generators/ripple/RippleMaterial';
import { PaintTrail } from '../generators/abstract/PaintTrail';

/**
 * Mode "Ripple" — whatever background is active (an uploaded image, an uploaded video, or the live
 * camera) AND your own live self-view both ride the same movement-driven ripple displacement and
 * blend together, so it reads as you and the imported content melting into one another. With no
 * background selected there's nothing to ripple, so the mode stays hidden.
 */
export class RippleMode {
  readonly mesh: THREE.Mesh;
  readonly material: RippleMaterial;

  private sceneManager: SceneManager;
  private videoEl: HTMLVideoElement;
  private backgroundLayer: BackgroundLayer;
  private paintTrail = new PaintTrail();
  private selfViewTexture: THREE.VideoTexture;

  constructor(sceneManager: SceneManager, videoEl: HTMLVideoElement, backgroundLayer: BackgroundLayer) {
    this.sceneManager = sceneManager;
    this.videoEl = videoEl;
    this.backgroundLayer = backgroundLayer;
    this.material = new RippleMaterial();

    this.selfViewTexture = new THREE.VideoTexture(videoEl);
    this.selfViewTexture.colorSpace = THREE.SRGBColorSpace;

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

  update(poseTracker: PoseTracker, _appState: AppState, elapsedSeconds: number, dt: number): void {
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
    this.material.setEnergy(Math.min(poseTracker.state.energy * 3, 1.5));

    this.paintTrail.update(poseTracker, this.sceneManager, dt);
    this.material.setTrail(this.paintTrail.getTexture());

    // The webcam video's first GPU upload happens on first use regardless of readiness — uploading a
    // 0x0 video (no stream/frame yet) throws GL_INVALID_VALUE (same guard BackgroundLayer uses).
    if (this.videoEl.readyState >= 2 && this.videoEl.videoWidth > 0) {
      const selfAspect = this.videoEl.videoWidth / this.videoEl.videoHeight;
      let repeatX = 1;
      let repeatY = 1;
      let offsetX = 0;
      let offsetY = 0;
      if (selfAspect > aspect) {
        repeatX = aspect / selfAspect;
        offsetX = (1 - repeatX) / 2;
      } else {
        repeatY = selfAspect / aspect;
        offsetY = (1 - repeatY) / 2;
      }
      // Mirror horizontally to match the mirrored-selfie stage convention every mode's body tracking
      // already uses (same trick BackgroundLayer.updateCover applies to its own texture).
      this.material.setSelfView(this.selfViewTexture);
      this.material.setSelfViewCover(-repeatX, repeatY, offsetX + repeatX, offsetY);
    } else {
      this.material.setSelfView(null);
    }
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.paintTrail.dispose();
    this.selfViewTexture.dispose();
  }
}
