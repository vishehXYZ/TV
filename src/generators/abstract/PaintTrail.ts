import * as THREE from 'three';
import type { PoseTracker } from '../../tracking/PoseTracker';
import type { SceneManager } from '../../core/SceneManager';

const ANCHOR_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const GRID_SIZE = 96;
/** Fraction the whole grid's intensity multiplies by each second — a continuous, smooth decay curve rather than discrete splat lifetimes popping in and out. */
const DECAY_PER_SEC = 0.22;
/** Stamp radius in grid cells — wide enough that overlapping stamps from nearby joints blend into one continuous soft shape instead of separate dots. */
const STAMP_RADIUS = 11;
const SPEED_TO_INTENSITY = 0.8;
const MIN_SPEED = 0.04;

/**
 * A continuously-updated, softly-decaying "heat trail" grid: every frame,
 * each moving joint stamps a soft gaussian blob at its position (brighter
 * for faster movement), and the whole grid fades smoothly over time. Read
 * as a filtered texture, this produces an organic, constantly-flowing
 * reveal shape that follows the body's motion like wet paint — not a set
 * of discrete splats with individual pop-in/hold/fade timers.
 */
/** How many virtual points wander/paint when no body is present and sound alone drives the trail. */
const VIRTUAL_POINT_COUNT = 3;

export class PaintTrail {
  private grid: Float32Array = new Float32Array(GRID_SIZE * GRID_SIZE);
  private texture: THREE.DataTexture;
  private prevStagePos: (THREE.Vector2 | null)[] = ANCHOR_JOINTS.map(() => null);
  private stagePos = new THREE.Vector2();
  private virtualTime = 0;
  private virtualSeed = Math.random() * 1000;

  constructor() {
    this.texture = new THREE.DataTexture(this.grid, GRID_SIZE, GRID_SIZE, THREE.RedFormat, THREE.FloatType);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.flipY = true;
  }

  update(poseTracker: PoseTracker, sceneManager: SceneManager, dt: number): void {
    if (dt > 0.0001) {
      const decay = Math.pow(DECAY_PER_SEC, dt);
      for (let i = 0; i < this.grid.length; i++) this.grid[i] *= decay;
    }

    const state = poseTracker.state;
    if (state.hasDetection && dt > 0.0001) {
      for (let i = 0; i < ANCHOR_JOINTS.length; i++) {
        const lm = state.landmarks[ANCHOR_JOINTS[i]!];
        if (!lm) continue;
        sceneManager.imageToStage(lm.x, lm.y, this.stagePos);
        const prev = this.prevStagePos[i];
        const speed = prev ? prev.distanceTo(this.stagePos) / dt : 0;
        if (!this.prevStagePos[i]) this.prevStagePos[i] = new THREE.Vector2();
        this.prevStagePos[i]!.copy(this.stagePos);

        if (speed > MIN_SPEED) {
          this.stamp(lm.x, lm.y, Math.min(speed * SPEED_TO_INTENSITY, 1));
        }
      }
    } else if (dt > 0.0001) {
      // No body (tracking paused, sound-only performance) — a few virtual points wander slowly and
      // paint the same soft trail, amplitude driven by movement-energy (which already includes the
      // audio level/kick), so the reveal keeps flowing organically with the music instead of fading
      // to nothing.
      this.virtualTime += dt;
      const amp = Math.min(poseTracker.state.energy * 1.2, 1);
      if (amp > 0.015) {
        for (let i = 0; i < VIRTUAL_POINT_COUNT; i++) {
          const phase = this.virtualTime * (0.16 + i * 0.05) + i * 2.4 + this.virtualSeed;
          const imgX = 0.5 + Math.cos(phase) * (0.22 + 0.12 * Math.sin(phase * 0.6));
          const imgY = 0.5 + Math.sin(phase * 1.3) * 0.22;
          this.stamp(imgX, imgY, amp * 0.85);
        }
      }
    }

    this.texture.needsUpdate = true;
  }

  private stamp(imgX: number, imgY: number, intensity: number): void {
    const cx = imgX * GRID_SIZE;
    const cy = imgY * GRID_SIZE;
    const r = STAMP_RADIUS;
    const sigma = r * 0.45;
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(GRID_SIZE - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(GRID_SIZE - 1, Math.ceil(cy + r));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        const falloff = Math.exp(-d2 / (2 * sigma * sigma));
        const idx = y * GRID_SIZE + x;
        // Max-blend rather than additive: dense overlapping stamps from many joints stay bounded to [0,1] instead of blowing out to white.
        this.grid[idx] = Math.max(this.grid[idx]!, falloff * intensity);
      }
    }
  }

  getTexture(): THREE.DataTexture {
    return this.texture;
  }

  get width(): number {
    return GRID_SIZE;
  }

  get height(): number {
    return GRID_SIZE;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
