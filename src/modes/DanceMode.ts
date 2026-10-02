import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { DanceStarMaterial, addMotifVarietyAttributes } from '../generators/girih/DanceStarMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';

/** Joints that act as vortex/attractor sources for the star flow field, and as body-repulsion sources. */
const FLOW_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
/** Jittered-grid layout (not pure random) so coverage stays even and there are no empty patches. */
const GRID_COLS = 34;
const GRID_ROWS = 24;
const INSTANCE_COUNT = GRID_COLS * GRID_ROWS;
/** Approximate body-clearance radius (stage units) used by the repulsion force, tuned for a torso-scale figure. */
const BODY_CLEARANCE = 0.22;
/** How quickly particle velocity snaps toward the movement-driven target (1/seconds) — higher = less lag. */
const RESPONSIVENESS = 9;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Home position stored normalized (-1..1); actual home is homeXNorm * current aspect so the field always fills the screen. */
  homeXNorm: number;
  homeYNorm: number;
  rot: number;
  rotSpeed: number;
  scale: number;
  seed: number;
}

/**
 * Mode 2 "Dance" — the body itself is cut out as empty space (via the
 * segmentation mask, inverted), while independent instanced stars of varied
 * Islamic geometric motifs swirl outside it, snapping directly to a
 * movement-driven target velocity rather than lagging or drifting.
 */
export class DanceMode {
  readonly mesh: THREE.InstancedMesh;
  readonly material: DanceStarMaterial;

  private sceneManager: SceneManager;
  private maskTexture = new SegmentationMaskTexture();
  private particles: Particle[] = [];
  private dummy = new THREE.Object3D();
  private jointPos: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private prevJointPos: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private jointVel: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private hasPrevJoints = false;

  constructor(sceneManager: SceneManager, appState: AppState) {
    this.sceneManager = sceneManager;
    this.material = new DanceStarMaterial(appState.palette);
    this.material.setInvertMask(true);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const seeds = new Float32Array(INSTANCE_COUNT);
    for (let i = 0; i < INSTANCE_COUNT; i++) seeds[i] = Math.random();
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    addMotifVarietyAttributes(geometry, INSTANCE_COUNT);

    this.mesh = new THREE.InstancedMesh(geometry, this.material, INSTANCE_COUNT);
    this.mesh.position.z = -0.2;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);

    const cellW = 2 / GRID_COLS;
    const cellH = 2 / GRID_ROWS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cx = -1 + cellW * (col + 0.5);
        const cy = -1 + cellH * (row + 0.5);
        const homeXNorm = cx + (Math.random() - 0.5) * cellW * 0.85;
        const homeYNorm = cy + (Math.random() - 0.5) * cellH * 0.85;
        this.particles.push({
          x: homeXNorm * sceneManager.aspect,
          y: homeYNorm,
          vx: 0,
          vy: 0,
          homeXNorm,
          homeYNorm,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 1.5,
          scale: 0.025 + Math.random() * 0.045,
          seed: Math.random(),
        });
      }
    }
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, dt: number): void {
    const aspect = this.sceneManager.aspect;
    this.material.setTime(elapsedSeconds);
    this.material.setStrokeWidth(appState.girih.strokeWidth);
    this.material.setPalette(appState.palette);
    this.material.setAspect(aspect);

    const state = poseTracker.state;
    const texture = this.maskTexture.update(state);
    this.material.setMask(texture, this.maskTexture.width, this.maskTexture.height);

    const clampedDt = Math.min(dt, 0.1);

    if (state.hasDetection) {
      for (let i = 0; i < FLOW_JOINTS.length; i++) {
        const lm = state.landmarks[FLOW_JOINTS[i]!];
        if (!lm) continue;
        this.sceneManager.imageToStage(lm.x, lm.y, this.jointPos[i]!);
      }
      if (this.hasPrevJoints && clampedDt > 0.0001) {
        for (let i = 0; i < FLOW_JOINTS.length; i++) {
          this.jointVel[i]!.set(
            (this.jointPos[i]!.x - this.prevJointPos[i]!.x) / clampedDt,
            (this.jointPos[i]!.y - this.prevJointPos[i]!.y) / clampedDt,
          );
        }
      }
      for (let i = 0; i < FLOW_JOINTS.length; i++) this.prevJointPos[i]!.copy(this.jointPos[i]!);
      this.hasPrevJoints = true;
    }

    // Exponential approach to a movement-driven target velocity: frame-rate
    // independent and snaps within a fraction of a second, so swirl speed
    // tracks actual movement speed instead of lagging behind or drifting on
    // afterward from accumulated momentum.
    const blend = 1 - Math.exp(-RESPONSIVENESS * clampedDt);

    for (let idx = 0; idx < this.particles.length; idx++) {
      const p = this.particles[idx]!;
      const homeX = p.homeXNorm * aspect;
      const homeY = p.homeYNorm;

      let targetVx = 0;
      let targetVy = 0;

      if (state.hasDetection) {
        for (let j = 0; j < FLOW_JOINTS.length; j++) {
          const jp = this.jointPos[j]!;
          const jv = this.jointVel[j]!;
          const dx = p.x - jp.x;
          const dy = p.y - jp.y;
          const distSq = dx * dx + dy * dy;
          const falloff = 1 / (distSq + 0.02);

          // Rotate joint velocity ~90deg for a swirling vortex feel; scales
          // directly with actual joint speed (no extra smoothing added here).
          targetVx += (jv.x * 0.4 - jv.y * 0.6) * falloff * 0.08;
          targetVy += (jv.y * 0.4 + jv.x * 0.6) * falloff * 0.08;

          if (distSq < BODY_CLEARANCE * BODY_CLEARANCE) {
            const dist = Math.sqrt(distSq) + 0.0001;
            const push = (BODY_CLEARANCE - dist) * 3.5;
            targetVx += (dx / dist) * push;
            targetVy += (dy / dist) * push;
          }
        }
      } else {
        // No body (tracking paused, sound-only performance) — a slow, soft per-particle swirl driven
        // entirely by movement-energy (which already includes the audio level/kick), so the field keeps
        // breathing and swaying with the music instead of freezing at rest.
        const ambientAmp = Math.min(state.energy * 1.8, 1.3);
        if (ambientAmp > 0.002) {
          const swirl = elapsedSeconds * 0.6 + p.seed * 6.283;
          targetVx += Math.cos(swirl + p.homeYNorm * 1.3) * ambientAmp * 0.6;
          targetVy += Math.sin(swirl * 1.15 + p.homeXNorm * 1.3) * ambientAmp * 0.6;
        }
      }

      // Weak pull toward home so idle particles don't drift indefinitely —
      // subordinate to movement so it doesn't fight the flow field.
      targetVx += (homeX - p.x) * 0.25;
      targetVy += (homeY - p.y) * 0.25;

      p.vx += (targetVx - p.vx) * blend;
      p.vy += (targetVy - p.vy) * blend;
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
      p.rot += p.rotSpeed * clampedDt;

      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.rotation.z = p.rot;
      this.dummy.scale.set(p.scale, p.scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(idx, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.maskTexture.dispose();
  }
}
