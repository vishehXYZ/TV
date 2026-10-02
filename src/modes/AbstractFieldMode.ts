import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { AbstractMaterial } from '../generators/abstract/AbstractMaterial';

/** Joints used as flow-field warp centers for the abstract noise field. */
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/**
 * Shared base for the two Abstract modes: owns the fullscreen painterly
 * noise field mesh/material and joint-driven warp/energy. Subclasses only
 * decide how the field gets revealed (body-shape mask vs movement-trail
 * splats) via `applyReveal`.
 */
export abstract class AbstractFieldMode {
  readonly mesh: THREE.Mesh;
  readonly material: AbstractMaterial;

  protected sceneManager: SceneManager;
  private joints: THREE.Vector2[] = JOINTS.map(() => new THREE.Vector2());

  constructor(sceneManager: SceneManager, appState: AppState) {
    this.sceneManager = sceneManager;
    this.material = new AbstractMaterial(appState.palette);
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -0.5;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, dt: number): void {
    const aspect = this.sceneManager.aspect;
    this.mesh.scale.set(aspect, 1, 1);
    this.material.setTime(elapsedSeconds);
    this.material.setAspect(aspect);
    this.material.setPalette(appState.palette);
    this.material.setParams(appState.abstract);

    const state = poseTracker.state;
    this.material.setEnergy(Math.min(state.energy * 6, 1.5));

    if (state.hasDetection) {
      let count = 0;
      for (let i = 0; i < JOINTS.length; i++) {
        const lm = state.landmarks[JOINTS[i]!];
        if (!lm) continue;
        this.sceneManager.imageToStage(lm.x, lm.y, this.joints[count]!);
        count++;
      }
      this.material.setJoints(this.joints.slice(0, count));
    } else {
      this.material.setJoints([]);
    }

    this.applyReveal(poseTracker, dt);
  }

  protected abstract applyReveal(poseTracker: PoseTracker, dt: number): void;

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
