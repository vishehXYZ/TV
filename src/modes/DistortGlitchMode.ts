import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import type { BackgroundLayer } from '../core/BackgroundLayer';
import { DistortGlitchMaterial } from '../generators/distortglitch/DistortGlitchMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/** How quickly the baseline distortion level eases toward its movement-driven target. */
const BASELINE_SMOOTH_SECONDS = 0.4;
/** Per-second decay factor applied to a burst — a burst reaches near-zero in roughly a quarter second. */
const BURST_DECAY_PER_SEC = 0.02;

/**
 * Mode "Distort Glitch" — a cousin of Glitch that trades blocky pixel
 * static for continuous wavy line distortion, a soft chromatic fringe
 * riding the wave, fine film-grain noise, and occasional full-width tears —
 * reads as analog signal interference (VHS/CRT) rather than digital
 * block-glitching. Same movement-driven baseline + burst behavior as
 * Glitch. With no background selected there's nothing to distort, so the
 * mode stays hidden.
 */
export class DistortGlitchMode {
  readonly mesh: THREE.Mesh;
  readonly material: DistortGlitchMaterial;

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
    this.material = new DistortGlitchMaterial();

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

    if (dt > 0.0001) {
      // Higher floor than the block-glitch mode's baseline (0.4) — this mode's effect needs more sustained
      // intensity to read clearly, since it leans on continuous wave amplitude rather than hard-edged blocks.
      const targetBaseline = THREE.MathUtils.clamp(state.energy * 2.6, 0, 0.6);
      this.baseline += (targetBaseline - this.baseline) * (1 - Math.exp(-dt / BASELINE_SMOOTH_SECONDS));
      this.burst *= Math.pow(BURST_DECAY_PER_SEC, dt);

      const spawnProb = Math.min(state.energy * 0.35, 0.6) * dt * 30;
      if (Math.random() < spawnProb) this.burst = 1.0;
    }

    this.material.setGlitchAmount(Math.min(this.baseline + this.burst, 1.8));
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.maskTexture.dispose();
  }
}
