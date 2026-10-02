import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import type { BackgroundLayer } from '../core/BackgroundLayer';
import { GlitchMaterial } from '../generators/glitch/GlitchMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/** How quickly the baseline glitch level eases toward its movement-driven target. */
const BASELINE_SMOOTH_SECONDS = 0.4;
/** Per-second decay factor applied to a burst — a burst reaches near-zero in roughly a quarter second. */
const BURST_DECAY_PER_SEC = 0.02;

/**
 * Mode "Glitch" — whatever background is active (live camera, an uploaded
 * image, or an uploaded video) plays normally, and the body itself
 * glitches: RGB channel splitting, per-row block displacement, and
 * flickering static, concentrated on the silhouette rather than the whole
 * frame. A steady low-level baseline scales with how much you're moving,
 * punctuated by short sharp bursts of intense glitching triggered by sudden
 * movement spikes. With no background selected there's nothing to glitch,
 * so the mode simply stays hidden.
 */
export class GlitchMode {
  readonly mesh: THREE.Mesh;
  readonly material: GlitchMaterial;

  private sceneManager: SceneManager;
  private videoEl: HTMLVideoElement;
  private backgroundLayer: BackgroundLayer;
  private maskTexture = new SegmentationMaskTexture();
  private baseline = 0;
  private burst = 0;

  constructor(sceneManager: SceneManager, videoEl: HTMLVideoElement, backgroundLayer: BackgroundLayer) {
    this.sceneManager = sceneManager;
    this.videoEl = videoEl;
    this.backgroundLayer = backgroundLayer;
    this.material = new GlitchMaterial();

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -0.95;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
    // Convenience default on first switch — a brand new user with no background chosen yet
    // still sees something. Any background choice made afterward (including back to None)
    // is picked up live in update(), since it reads backgroundLayer fresh every frame.
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
    // Reuse BackgroundLayer's own cover-crop/mirror transform (already baked into the texture each frame) instead of recomputing it.
    this.material.setVideoCover(texture.repeat.x, texture.repeat.y, texture.offset.x, texture.offset.y);
    this.material.setBackdropDim(this.backgroundLayer.getDim());
    this.material.setPalette(appState.palette);

    const state = poseTracker.state;
    const maskTex = this.maskTexture.update(state);
    this.material.setMask(maskTex, this.maskTexture.width, this.maskTexture.height);

    if (dt > 0.0001) {
      const targetBaseline = THREE.MathUtils.clamp(state.energy * 2.2, 0, 0.4);
      this.baseline += (targetBaseline - this.baseline) * (1 - Math.exp(-dt / BASELINE_SMOOTH_SECONDS));
      this.burst *= Math.pow(BURST_DECAY_PER_SEC, dt);

      // Sudden movement has a chance to trigger a short sharp glitch burst, not just scale the steady baseline.
      const spawnProb = Math.min(state.energy * 0.35, 0.6) * dt * 30;
      if (Math.random() < spawnProb) this.burst = 1.0;
    }

    this.material.setGlitchAmount(Math.min(this.baseline + this.burst, 1.6));
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.maskTexture.dispose();
  }
}
