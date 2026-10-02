import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { ChromaMaterial, CHROMA_ANCHOR_COUNT } from '../generators/chroma/ChromaMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/** Landmark groups averaged into each of the 6 body-region anchors: head, left hand, right hand,
 * torso, left leg, right leg. */
const ANCHOR_LANDMARK_GROUPS: readonly (readonly number[])[] = [
  [0],
  [15],
  [16],
  [11, 12, 23, 24],
  [23, 25, 27],
  [24, 26, 28],
];

/** Mode "Chroma" — colors your body silhouette itself by region (head/hands/torso/legs each pull
 * toward a different palette color), rather than surrounding it with motifs. Needs a real body to
 * have anything to color, same inherent constraint as Flurix's masked layer. */
export class ChromaMode {
  readonly mesh: THREE.Mesh;
  readonly material: ChromaMaterial;

  private sceneManager: SceneManager;
  private maskTexture = new SegmentationMaskTexture();
  private anchors: THREE.Vector2[] = Array.from({ length: CHROMA_ANCHOR_COUNT }, () => new THREE.Vector2());
  private tmp = new THREE.Vector2();

  constructor(sceneManager: SceneManager, appState: AppState) {
    this.sceneManager = sceneManager;
    this.material = new ChromaMaterial(appState.palette);

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

    if (!state.hasDetection) {
      this.material.setAnchors([]);
    } else {
      let count = 0;
      for (const group of ANCHOR_LANDMARK_GROUPS) {
        let sx = 0;
        let sy = 0;
        let found = 0;
        for (const idx of group) {
          const lm = state.landmarks[idx];
          if (!lm) continue;
          sx += lm.x;
          sy += lm.y;
          found++;
        }
        if (found === 0) continue;
        this.sceneManager.imageToStage(sx / found, sy / found, this.tmp);
        this.anchors[count]!.copy(this.tmp);
        count++;
      }
      this.material.setAnchors(this.anchors.slice(0, count));
    }

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
