import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import type { BackgroundLayer } from '../core/BackgroundLayer';
import { DissolveSystem, MAX_PARTICLES } from '../generators/dissolve/DissolveSystem';
import { DanceStarMaterial, addMotifVarietyAttributes } from '../generators/girih/DanceStarMaterial';
import { VideoColorSampler } from '../tracking/VideoColorSampler';

/**
 * Mode "Dissolve Lines" — the same motion-gated body break-apart as
 * Dissolve, but each fragment is a small geometric girih-star motif
 * (palette-colored, shrinking to nothing as it fades) instead of a soft
 * gaussian dust particle — the body shatters into Islamic-geometric
 * fragments rather than dissolving into dust.
 */
export class DissolveLinesMode {
  readonly mesh: THREE.InstancedMesh;
  readonly material: DanceStarMaterial;

  private sceneManager: SceneManager;
  private videoEl: HTMLVideoElement;
  private backgroundLayer: BackgroundLayer;
  private system = new DissolveSystem();
  private sampler = new VideoColorSampler();
  private dummy = new THREE.Object3D();

  constructor(sceneManager: SceneManager, videoEl: HTMLVideoElement, backgroundLayer: BackgroundLayer, appState: AppState) {
    this.sceneManager = sceneManager;
    this.videoEl = videoEl;
    this.backgroundLayer = backgroundLayer;
    this.material = new DanceStarMaterial(appState.palette);
    this.material.setStrokeWidth(0.09);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const seeds = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) seeds[i] = Math.random();
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    addMotifVarietyAttributes(geometry, MAX_PARTICLES);

    this.mesh = new THREE.InstancedMesh(geometry, this.material, MAX_PARTICLES);
    this.mesh.position.z = -0.1;
    this.mesh.visible = false;
    // Instances scatter far from the base 2x2 plane's own bounds; without this, frustum culling can
    // misjudge the (uncomputed) instanced bounding volume and skip rendering the object entirely.
    this.mesh.frustumCulled = false;
    sceneManager.scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
    if (visible && this.backgroundLayer.mode === 'none') {
      this.backgroundLayer.setCamera(this.videoEl);
    }
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, dt: number): void {
    this.material.setTime(elapsedSeconds);
    this.material.setPalette(appState.palette);
    this.material.setAspect(this.sceneManager.aspect);

    this.sampler.update(this.videoEl);
    this.system.update(poseTracker, this.sceneManager, this.sampler, dt);

    let i = 0;
    for (const p of this.system.particles) {
      if (i >= MAX_PARTICLES) break;
      // DanceStarMaterial has no per-instance alpha uniform, so fade is approximated by shrinking toward
      // nothing — reads naturally here, like a fragment dissipating rather than a dot fading out.
      const scale = this.system.getScale(p) * 2.2 * this.system.getAlpha(p);
      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.rotation.z = p.seed * 6.283 + elapsedSeconds * 0.4;
      this.dummy.scale.set(scale, scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      i++;
    }
    for (; i < MAX_PARTICLES; i++) {
      this.dummy.position.set(0, 0, -10);
      this.dummy.scale.set(0, 0, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
