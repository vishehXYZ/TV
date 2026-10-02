import * as THREE from 'three';
import type { SceneManager } from '../../core/SceneManager';
import type { PoseTracker } from '../../tracking/PoseTracker';
import type { VideoColorSampler } from '../../tracking/VideoColorSampler';

export interface DissolveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  driftPhase: number;
  r: number;
  g: number;
  b: number;
  spawnedAt: number;
  maxScale: number;
  seed: number;
}

interface HotJoint {
  imgX: number;
  imgY: number;
  speed: number;
  vel: THREE.Vector2;
}

const FLOW_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
export const MAX_PARTICLES = 3000;
const LIFETIME = 2.6;
const GROW_FRACTION = 0.12;
const HOLD_FRACTION = 0.55;
const MAX_SPAWN_PER_TICK = 46;
/** Normalized stage-units/sec — a joint below this speed contributes no spawns, so a still body (planted legs, etc.) stays as plain sharp video and only the actively-swooshing parts dissolve. */
const SPEED_THRESHOLD = 0.4;
/** Converts aggregate hot-joint speed into a spawn-count budget per tick. */
const SPAWN_SPEED_SCALE = 3.2;
/** Normalized image-space radius particles jitter from their source joint — keeps the dissolve cloud clustered around the actual moving limb instead of scattered across the whole body. */
const JITTER_RADIUS = 0.1;
/** Caps how far a particle's initial motion-inherited fling can carry it, so even a very fast real movement keeps the dissolve cloud clustered near the limb instead of launching particles clear across the screen. */
const MAX_BURST_SPEED = 1.1;
/** Gentle sideways wander once the initial motion-inherited burst velocity has decayed — reads as dust floating rather than snapping to a stop. */
const DRIFT_STRENGTH = 0.035;
/** Slow upward bias, like dust motes drifting rather than falling. */
const BUOYANCY = 0.02;

/**
 * The actively-moving parts of the body silhouette (not the whole body —
 * only the regions near fast-moving joints) break apart into a dense,
 * lingering cloud of chunky, color-sampled particles that drift gently and
 * fade slowly, revealing the real video behind them — a still body stays as
 * plain sharp video, matching the reference "Pixie move" effect where only
 * the swooshing motion trail dissolves.
 */
/** How many virtual wandering sources spawn dissolve particles when no body is present. */
const VIRTUAL_POINT_COUNT = 3;

export class DissolveSystem {
  particles: DissolveParticle[] = [];

  private nowValue = 0;
  private jointPos: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private prevJointPos: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private jointVel: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private hasPrevJoints = false;
  private hotJoints: HotJoint[] = [];
  private virtualSeed = Math.random() * 1000;

  get now(): number {
    return this.nowValue;
  }

  getAlpha(p: DissolveParticle): number {
    const age = this.nowValue - p.spawnedAt;
    const t = age / LIFETIME;
    if (t < GROW_FRACTION) return t / GROW_FRACTION;
    if (t < HOLD_FRACTION) return 1;
    return Math.max(0, 1 - (t - HOLD_FRACTION) / (1 - HOLD_FRACTION));
  }

  getScale(p: DissolveParticle): number {
    const age = this.nowValue - p.spawnedAt;
    const t = Math.min(age / (LIFETIME * GROW_FRACTION), 1);
    return p.maxScale * (0.4 + 0.6 * t);
  }

  update(poseTracker: PoseTracker, sceneManager: SceneManager, sampler: VideoColorSampler, dt: number): void {
    this.nowValue += dt;
    const state = poseTracker.state;

    if (state.hasDetection) {
      this.hotJoints.length = 0;
      let totalSpeed = 0;

      for (let i = 0; i < FLOW_JOINTS.length; i++) {
        const lm = state.landmarks[FLOW_JOINTS[i]!];
        if (!lm) continue;
        sceneManager.imageToStage(lm.x, lm.y, this.jointPos[i]!);

        if (this.hasPrevJoints && dt > 0.0001) {
          const vel = this.jointVel[i]!;
          vel.set((this.jointPos[i]!.x - this.prevJointPos[i]!.x) / dt, (this.jointPos[i]!.y - this.prevJointPos[i]!.y) / dt);
          const speed = vel.length();
          totalSpeed += speed;
          if (speed > SPEED_THRESHOLD) {
            this.hotJoints.push({ imgX: lm.x, imgY: lm.y, speed, vel });
          }
        }
        this.prevJointPos[i]!.copy(this.jointPos[i]!);
      }
      this.hasPrevJoints = true;

      const mask = state.segmentationMask;
      if (mask && this.hotJoints.length > 0) {
        const spawnCount = Math.min(Math.round(totalSpeed * SPAWN_SPEED_SCALE), MAX_SPAWN_PER_TICK);
        const speedSum = this.hotJoints.reduce((sum, h) => sum + h.speed, 0);

        for (let s = 0; s < spawnCount && this.particles.length < MAX_PARTICLES; s++) {
          let pick = Math.random() * speedSum;
          let chosen = this.hotJoints[0]!;
          for (const h of this.hotJoints) {
            pick -= h.speed;
            if (pick <= 0) {
              chosen = h;
              break;
            }
          }

          let imgX = 0;
          let imgY = 0;
          let found = false;
          for (let attempt = 0; attempt < 8; attempt++) {
            const cx = THREE.MathUtils.clamp(chosen.imgX + (Math.random() - 0.5) * JITTER_RADIUS, 0, 1);
            const cy = THREE.MathUtils.clamp(chosen.imgY + (Math.random() - 0.5) * JITTER_RADIUS, 0, 1);
            const col = Math.min(mask.width - 1, Math.floor(cx * mask.width));
            const row = Math.min(mask.height - 1, Math.floor(cy * mask.height));
            if (mask.data[row * mask.width + col]! > 0.5) {
              imgX = cx;
              imgY = cy;
              found = true;
              break;
            }
          }
          if (!found) continue;

          const pos = new THREE.Vector2();
          sceneManager.imageToStage(imgX, imgY, pos);
          const [r, g, b] = sampler.sample(imgX, imgY);

          this.particles.push({
            x: pos.x,
            y: pos.y,
            vx: THREE.MathUtils.clamp(chosen.vel.x * 0.3, -MAX_BURST_SPEED, MAX_BURST_SPEED) + (Math.random() - 0.5) * 0.2,
            vy: THREE.MathUtils.clamp(chosen.vel.y * 0.3, -MAX_BURST_SPEED, MAX_BURST_SPEED) + (Math.random() - 0.5) * 0.2,
            driftPhase: Math.random() * Math.PI * 2,
            r: r / 255,
            g: g / 255,
            b: b / 255,
            spawnedAt: this.nowValue,
            maxScale: 0.022 + Math.random() * 0.05,
            seed: Math.random(),
          });
        }
      }
    } else if (dt > 0.0001) {
      // No body (tracking paused, sound-only performance) — a few virtual points wander slowly around
      // the frame and spawn the same dissolve particles (still color-sampled from the live video),
      // amplitude driven by movement-energy (which already includes the audio level/kick), so the
      // cloud keeps forming and drifting organically with the music instead of dying out in ~2.6s.
      const energy = poseTracker.state.energy;
      if (energy > 0.05) {
        const spawnCount = Math.min(Math.round(energy * SPAWN_SPEED_SCALE * 2.5), MAX_SPAWN_PER_TICK);
        for (let s = 0; s < spawnCount && this.particles.length < MAX_PARTICLES; s++) {
          const i = Math.floor(Math.random() * VIRTUAL_POINT_COUNT);
          const phase = this.nowValue * (0.2 + i * 0.06) + i * 2.1 + this.virtualSeed;
          // Wider wander radius than the original 0.18-0.28 — spreads the cloud across much more of the
          // screen instead of a small central patch, which read as barely-there against the soft-blob material.
          const cx = 0.5 + Math.cos(phase) * (0.32 + 0.14 * Math.sin(phase * 0.5));
          const cy = 0.5 + Math.sin(phase * 1.2) * 0.3;
          const imgX = THREE.MathUtils.clamp(cx + (Math.random() - 0.5) * JITTER_RADIUS, 0, 1);
          const imgY = THREE.MathUtils.clamp(cy + (Math.random() - 0.5) * JITTER_RADIUS, 0, 1);

          const pos = new THREE.Vector2();
          sceneManager.imageToStage(imgX, imgY, pos);
          const [r, g, b] = sampler.sample(imgX, imgY);

          this.particles.push({
            x: pos.x,
            y: pos.y,
            vx: Math.cos(phase * 2) * 0.3 * Math.min(energy, 1) + (Math.random() - 0.5) * 0.15,
            vy: Math.sin(phase * 2) * 0.3 * Math.min(energy, 1) + (Math.random() - 0.5) * 0.15,
            driftPhase: Math.random() * Math.PI * 2,
            r: r / 255,
            g: g / 255,
            b: b / 255,
            spawnedAt: this.nowValue,
            // Slightly larger than the movement-spawned range (0.022-0.072) — a bit more visual presence
            // to compensate for this material's naturally soft/subtle look when spread over a wide area.
            maxScale: 0.028 + Math.random() * 0.065,
            seed: Math.random(),
          });
        }
      }
    }

    for (const p of this.particles) {
      const age = this.nowValue - p.spawnedAt;
      const driftX = Math.sin(this.nowValue * 0.7 + p.driftPhase) * DRIFT_STRENGTH;
      const driftY = Math.cos(this.nowValue * 0.55 + p.driftPhase * 1.3) * DRIFT_STRENGTH * 0.6 + BUOYANCY;
      // The initial motion-inherited burst fades quickly; slow ambient drift takes over so particles read as floating dust, not frozen dots.
      const burstWeight = Math.max(0, 1 - age / 0.5);
      p.x += (p.vx * burstWeight + driftX) * dt;
      p.y += (p.vy * burstWeight + driftY) * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }

    // Filter by age rather than getAlpha(p) > 0 — a just-spawned particle has age 0, which sits exactly
    // at the start of the grow ramp (alpha 0), so filtering on alpha would delete it the instant it spawns.
    this.particles = this.particles.filter((p) => this.nowValue - p.spawnedAt < LIFETIME);
  }
}
