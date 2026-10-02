import * as THREE from 'three';
import type { SceneManager } from '../../core/SceneManager';
import type { PoseTracker } from '../../tracking/PoseTracker';

export interface FlowParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Home position stored normalized (-1..1); actual home is homeXNorm * current aspect so the field always fills the screen. */
  homeXNorm: number;
  homeYNorm: number;
  seed: number;
}

export interface FlowFieldOptions {
  gridCols: number;
  gridRows: number;
  flowJoints?: number[];
  bodyClearance?: number;
  responsiveness?: number;
  homeSpringStrength?: number;
  /** Fraction of a grid cell a particle's home position is randomly jittered by (default 0.85). */
  jitterFrac?: number;
}

const DEFAULT_FLOW_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

/**
 * Shared particle physics behind Dance/Code's "always-visible field that
 * reacts to movement" feel: a jittered grid of particles, each pulled
 * toward a joint-driven vortex flow field (with body-clearance repulsion)
 * when a pose is detected, and pulled back toward its home position by a
 * weak spring otherwise — snappy, frame-rate-independent velocity tracking
 * rather than slow growth or drift. Renders nothing itself; callers own
 * their own geometry/material and read `.particles` to build instance
 * matrices however they like.
 */
export class FlowFieldParticles {
  particles: FlowParticle[] = [];

  private sceneManager: SceneManager;
  private flowJoints: number[];
  private bodyClearance: number;
  private responsiveness: number;
  private homeSpringStrength: number;
  private jointPos: THREE.Vector2[];
  private prevJointPos: THREE.Vector2[];
  private jointVel: THREE.Vector2[];
  private hasPrevJoints = false;
  private hasJointsThisTick = false;

  constructor(sceneManager: SceneManager, options: FlowFieldOptions) {
    this.sceneManager = sceneManager;
    this.flowJoints = options.flowJoints ?? DEFAULT_FLOW_JOINTS;
    this.bodyClearance = options.bodyClearance ?? 0.22;
    this.responsiveness = options.responsiveness ?? 9;
    this.homeSpringStrength = options.homeSpringStrength ?? 0.25;
    this.jointPos = this.flowJoints.map(() => new THREE.Vector2());
    this.prevJointPos = this.flowJoints.map(() => new THREE.Vector2());
    this.jointVel = this.flowJoints.map(() => new THREE.Vector2());

    const cellW = 2 / options.gridCols;
    const cellH = 2 / options.gridRows;
    const jitter = options.jitterFrac ?? 0.85;
    for (let row = 0; row < options.gridRows; row++) {
      for (let col = 0; col < options.gridCols; col++) {
        const cx = -1 + cellW * (col + 0.5);
        const cy = -1 + cellH * (row + 0.5);
        const homeXNorm = cx + (Math.random() - 0.5) * cellW * jitter;
        const homeYNorm = cy + (Math.random() - 0.5) * cellH * jitter;
        this.particles.push({
          x: homeXNorm * sceneManager.aspect,
          y: homeYNorm,
          vx: 0,
          vy: 0,
          homeXNorm,
          homeYNorm,
          seed: Math.random(),
        });
      }
    }
  }

  /** Refreshes joint position/velocity tracking from the current pose. Call once per frame before step(). */
  updateJoints(poseTracker: PoseTracker, dt: number): void {
    const state = poseTracker.state;
    this.hasJointsThisTick = state.hasDetection;
    if (!state.hasDetection) return;

    for (let i = 0; i < this.flowJoints.length; i++) {
      const lm = state.landmarks[this.flowJoints[i]!];
      if (!lm) continue;
      this.sceneManager.imageToStage(lm.x, lm.y, this.jointPos[i]!);
    }
    if (this.hasPrevJoints && dt > 0.0001) {
      for (let i = 0; i < this.flowJoints.length; i++) {
        this.jointVel[i]!.set(
          (this.jointPos[i]!.x - this.prevJointPos[i]!.x) / dt,
          (this.jointPos[i]!.y - this.prevJointPos[i]!.y) / dt,
        );
      }
    }
    for (let i = 0; i < this.flowJoints.length; i++) this.prevJointPos[i]!.copy(this.jointPos[i]!);
    this.hasPrevJoints = true;
  }

  /**
   * Advances all particles one tick. extraForce, if given, is called per-particle to add mode-specific
   * bias (e.g. a constant upward buoyancy) on top of the shared vortex/clearance/home-spring forces —
   * it receives the particle and an output vector to add an additional target-velocity contribution to.
   */
  step(dt: number, extraForce?: (p: FlowParticle, out: THREE.Vector2) => void): void {
    const clampedDt = Math.min(dt, 0.1);
    const aspect = this.sceneManager.aspect;
    const blend = 1 - Math.exp(-this.responsiveness * clampedDt);
    const hasJoints = this.hasJointsThisTick;
    const extraOut = new THREE.Vector2();

    for (const p of this.particles) {
      const homeX = p.homeXNorm * aspect;
      const homeY = p.homeYNorm;
      let targetVx = 0;
      let targetVy = 0;

      if (hasJoints) {
        for (let j = 0; j < this.flowJoints.length; j++) {
          const jp = this.jointPos[j]!;
          const jv = this.jointVel[j]!;
          const dx = p.x - jp.x;
          const dy = p.y - jp.y;
          const distSq = dx * dx + dy * dy;
          const falloff = 1 / (distSq + 0.02);

          targetVx += (jv.x * 0.4 - jv.y * 0.6) * falloff * 0.08;
          targetVy += (jv.y * 0.4 + jv.x * 0.6) * falloff * 0.08;

          if (distSq < this.bodyClearance * this.bodyClearance) {
            const dist = Math.sqrt(distSq) + 0.0001;
            const push = (this.bodyClearance - dist) * 3.5;
            targetVx += (dx / dist) * push;
            targetVy += (dy / dist) * push;
          }
        }
      }

      targetVx += (homeX - p.x) * this.homeSpringStrength;
      targetVy += (homeY - p.y) * this.homeSpringStrength;

      if (extraForce) {
        extraOut.set(0, 0);
        extraForce(p, extraOut);
        targetVx += extraOut.x;
        targetVy += extraOut.y;
      }

      p.vx += (targetVx - p.vx) * blend;
      p.vy += (targetVy - p.vy) * blend;
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
    }
  }
}
