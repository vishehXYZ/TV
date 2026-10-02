import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { GirihGridMaterial } from '../generators/girih/GirihGridMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/** Core body bones used to warp the girih lattice so it flows along limbs. */
const BONE_PAIRS: ReadonlyArray<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

/** Mode 1 "Fill" — girih star tessellation clipped to and warped along the body silhouette. */
export class FillMode {
  readonly mesh: THREE.Mesh;
  readonly material: GirihGridMaterial;
  /** Large-scale, dim, unmasked layer drifting behind the body silhouette for ambient depth. */
  readonly ambientMesh: THREE.Mesh;
  readonly ambientMaterial: GirihGridMaterial;

  private sceneManager: SceneManager;
  private maskTexture = new SegmentationMaskTexture();
  private bones: THREE.Vector4[] = BONE_PAIRS.map(() => new THREE.Vector4());
  private tmpA = new THREE.Vector2();
  private tmpB = new THREE.Vector2();

  constructor(sceneManager: SceneManager, appState: AppState) {
    this.sceneManager = sceneManager;

    this.ambientMaterial = new GirihGridMaterial(appState.palette);
    this.ambientMaterial.setOpacity(0.28);
    const ambientGeometry = new THREE.PlaneGeometry(2, 2);
    this.ambientMesh = new THREE.Mesh(ambientGeometry, this.ambientMaterial);
    this.ambientMesh.position.z = -0.6;
    sceneManager.scene.add(this.ambientMesh);

    this.material = new GirihGridMaterial(appState.palette);
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -0.5;
    sceneManager.scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
    this.ambientMesh.visible = visible;
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number): void {
    const aspect = this.sceneManager.aspect;
    const state = poseTracker.state;

    this.mesh.scale.set(aspect, 1, 1);
    this.ambientMesh.scale.set(aspect, 1, 1);

    this.material.setAspect(aspect);
    this.material.setParams(appState.girih);
    this.material.setPalette(appState.palette);
    this.material.setTime(elapsedSeconds);
    this.material.setEnergy(Math.min(state.energy * 6, 1.5));

    this.ambientMaterial.setAspect(aspect);
    this.ambientMaterial.setParams({ ...appState.girih, density: appState.girih.density * 0.42, warpStrength: 0 });
    this.ambientMaterial.setPalette(appState.palette);
    this.ambientMaterial.setTime(elapsedSeconds * 0.6 + 100);
    this.ambientMaterial.setEnergy(Math.min(state.energy * 2, 0.6));

    if (!state.hasDetection) {
      this.material.setBones([]);
    } else {
      let count = 0;
      for (let i = 0; i < BONE_PAIRS.length; i++) {
        const pair = BONE_PAIRS[i]!;
        const la = state.landmarks[pair[0]];
        const lb = state.landmarks[pair[1]];
        if (!la || !lb) continue;
        this.sceneManager.imageToStage(la.x, la.y, this.tmpA);
        this.sceneManager.imageToStage(lb.x, lb.y, this.tmpB);
        this.bones[count]!.set(this.tmpA.x, this.tmpA.y, this.tmpB.x, this.tmpB.y);
        count++;
      }
      this.material.setBones(this.bones.slice(0, count));
    }

    const texture = this.maskTexture.update(state);
    this.material.setMask(texture, this.maskTexture.width, this.maskTexture.height);
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.sceneManager.scene.remove(this.ambientMesh);
    this.mesh.geometry.dispose();
    this.ambientMesh.geometry.dispose();
    this.material.dispose();
    this.ambientMaterial.dispose();
    this.maskTexture.dispose();
  }
}
