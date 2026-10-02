import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { SketchMaterial } from '../generators/sketch/SketchMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/** Mode "Sketch" — your body silhouette traced as several overlapping, independently-jittered
 * contour strokes redrawn on a stepped clock, reading as a hand-drawn "boiling" line-animation
 * rather than a filled shape. Needs a real body (a contour to trace), same inherent constraint as
 * Flurix/Chroma's masked layers. */
export class SketchMode {
  readonly mesh: THREE.Mesh;
  readonly material: SketchMaterial;

  private sceneManager: SceneManager;
  private maskTexture = new SegmentationMaskTexture();

  constructor(sceneManager: SceneManager, appState: AppState) {
    this.sceneManager = sceneManager;
    this.material = new SketchMaterial(appState.palette);

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -0.5;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number): void {
    const aspect = this.sceneManager.aspect;
    const state = poseTracker.state;

    this.mesh.scale.set(aspect, 1, 1);
    this.material.setAspect(aspect);
    this.material.setPalette(appState.palette);
    this.material.setTime(elapsedSeconds);
    this.material.setEnergy(Math.min(state.energy * 6, 1.5));
    this.material.setLineThickness(appState.sketch.lineThickness);

    const texture = this.maskTexture.update(state);
    this.material.setMask(texture, this.maskTexture.width, this.maskTexture.height);
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.maskTexture.dispose();
  }
}
