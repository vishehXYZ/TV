import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import { POSE_CONNECTIONS, type PoseState } from './PoseState';

/** Debug skeleton visualization — draws joints as points and bones as lines. */
export class SkeletonOverlay {
  private points: THREE.Points;
  private lines: THREE.LineSegments;
  private pointGeom: THREE.BufferGeometry;
  private lineGeom: THREE.BufferGeometry;
  private tmp = new THREE.Vector2();
  private sceneManager: SceneManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.pointGeom = new THREE.BufferGeometry();
    this.pointGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(33 * 3), 3));
    const pointMat = new THREE.PointsMaterial({ color: 0xffd76a, size: 0.025 });
    this.points = new THREE.Points(this.pointGeom, pointMat);

    this.lineGeom = new THREE.BufferGeometry();
    this.lineGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(POSE_CONNECTIONS.length * 2 * 3), 3),
    );
    const lineMat = new THREE.LineBasicMaterial({ color: 0x6ad4ff, transparent: true, opacity: 0.8 });
    this.lines = new THREE.LineSegments(this.lineGeom, lineMat);

    sceneManager.scene.add(this.points, this.lines);
  }

  update(state: PoseState): void {
    const visible = state.hasDetection && state.landmarks.length > 0;
    this.points.visible = visible;
    this.lines.visible = visible;
    if (!visible) return;

    const pointPos = this.pointGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < state.landmarks.length; i++) {
      const lm = state.landmarks[i];
      this.sceneManager.imageToStage(lm.x, lm.y, this.tmp);
      pointPos.setXYZ(i, this.tmp.x, this.tmp.y, 0);
    }
    pointPos.needsUpdate = true;

    const linePos = this.lineGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < POSE_CONNECTIONS.length; i++) {
      const [a, b] = POSE_CONNECTIONS[i];
      const la = state.landmarks[a];
      const lb = state.landmarks[b];
      if (!la || !lb) continue;
      this.sceneManager.imageToStage(la.x, la.y, this.tmp);
      linePos.setXYZ(i * 2, this.tmp.x, this.tmp.y, 0);
      this.sceneManager.imageToStage(lb.x, lb.y, this.tmp);
      linePos.setXYZ(i * 2 + 1, this.tmp.x, this.tmp.y, 0);
    }
    linePos.needsUpdate = true;
  }
}
