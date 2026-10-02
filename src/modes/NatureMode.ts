import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { DanceStarMaterial } from '../generators/girih/DanceStarMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import { FlowFieldParticles } from './shared/FlowFieldParticles';

const GRID_COLS = 22;
const GRID_ROWS = 16;
const INSTANCE_COUNT = GRID_COLS * GRID_ROWS;

/**
 * Mode "Nature" — a field of soft, round, glowing orbs fills the screen
 * (body cut out as empty space, same as Dance/Code), reacting to movement
 * through the same live flow field Dance uses, plus a continuous gentle
 * ambient wobble and breathing pulse so it's always visibly alive, never
 * static. Movement/sound energy also boosts the pulse directly, so it
 * reads even when driven by music alone with no camera. Colored by the
 * shared app palette like every other mode.
 */
export class NatureMode {
  readonly mesh: THREE.InstancedMesh;
  readonly material: DanceStarMaterial;

  private sceneManager: SceneManager;
  private maskTexture = new SegmentationMaskTexture();
  private flow: FlowFieldParticles;
  private dummy = new THREE.Object3D();

  constructor(sceneManager: SceneManager, appState: AppState) {
    this.sceneManager = sceneManager;
    this.material = new DanceStarMaterial(appState.palette);
    this.material.setInvertMask(true);
    // Only a modest bump over Dance's own default (0.06): with hundreds of additively-blended instances
    // plus the bloom pass, anything much wider oversaturates the entire screen to solid white (confirmed
    // via direct pixel testing) — the rounded SDF shape itself (symmetry=10, innerRatio=0.82) already
    // reads as a soft round form even with a fairly thin stroke.
    this.material.setStrokeWidth(0.09);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const seeds = new Float32Array(INSTANCE_COUNT);
    // Fixed near-circular SDF params on every instance — a rounded soft orb, not a spiky star.
    const symmetry = new Float32Array(INSTANCE_COUNT).fill(10);
    const innerRatio = new Float32Array(INSTANCE_COUNT).fill(0.82);
    const sharpness = new Float32Array(INSTANCE_COUNT).fill(1.1);
    for (let i = 0; i < INSTANCE_COUNT; i++) seeds[i] = Math.random();
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute('aSymmetry', new THREE.InstancedBufferAttribute(symmetry, 1));
    geometry.setAttribute('aInnerRatio', new THREE.InstancedBufferAttribute(innerRatio, 1));
    geometry.setAttribute('aSharpness', new THREE.InstancedBufferAttribute(sharpness, 1));

    this.mesh = new THREE.InstancedMesh(geometry, this.material, INSTANCE_COUNT);
    this.mesh.position.z = -0.2;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);

    this.flow = new FlowFieldParticles(sceneManager, {
      gridCols: GRID_COLS,
      gridRows: GRID_ROWS,
      // Lazier and softer than Dance's snappy default — reads as organic drifting rather than a snappy swirl.
      responsiveness: 5,
      homeSpringStrength: 0.18,
      bodyClearance: 0.24,
    });
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, dt: number): void {
    const aspect = this.sceneManager.aspect;
    this.material.setTime(elapsedSeconds);
    this.material.setPalette(appState.palette);
    this.material.setAspect(aspect);

    const state = poseTracker.state;
    const texture = this.maskTexture.update(state);
    this.material.setMask(texture, this.maskTexture.width, this.maskTexture.height);

    this.flow.updateJoints(poseTracker, Math.min(dt, 0.1));
    // Movement AND sound energy both boost this. Position/wobble amplitude can swing hard (it's just
    // motion, no extra brightness), but the scale/pulse contribution stays capped — with hundreds of
    // additively-blended instances plus the bloom pass, brightening them all too far blows the whole
    // screen out to solid white (confirmed via direct pixel testing). Works purely from music with no
    // camera enabled too — now that main.ts feeds this from the live, decaying audio level rather than
    // a stuck historical peak, it actually pulses with the beat instead of sitting at a flat plateau.
    const energyBoost = Math.min(state.energy * 1.6, 1.4);
    this.flow.step(dt, (p, out) => {
      // Gentle continuous ambient wobble layered on the shared flow field, so it never looks frozen at
      // rest — swings much wider with real energy so the sway reads as an obvious, organic dance.
      out.x += Math.sin(elapsedSeconds * 0.7 + p.seed * 20) * 0.09 * (0.35 + energyBoost);
      out.y += Math.cos(elapsedSeconds * 0.6 + p.seed * 17) * 0.09 * (0.35 + energyBoost);
    });

    let i = 0;
    for (const p of this.flow.particles) {
      const pulse = 0.8 + 0.2 * Math.sin(elapsedSeconds * 1.2 + p.seed * 6.283) + Math.min(energyBoost * 0.22, 0.34);
      const scale = (0.025 + p.seed * 0.045) * pulse;
      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.rotation.z = elapsedSeconds * 0.15 * (p.seed - 0.5) * 2;
      this.dummy.scale.set(scale, scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      i++;
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
