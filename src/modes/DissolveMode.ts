import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import type { BackgroundLayer } from '../core/BackgroundLayer';
import { DissolveSystem, MAX_PARTICLES } from '../generators/dissolve/DissolveSystem';
import { DissolveMaterial } from '../generators/dissolve/DissolveMaterial';
import { VideoColorSampler } from '../tracking/VideoColorSampler';
import { paletteColorAt } from '../core/paletteGrade';

/** How much a particle's video-sampled color is pulled toward the app palette (by luminance) vs. kept as raw video color. */
const PALETTE_GRADE_AMOUNT = 0.65;

/**
 * Mode "Cellis" — the body silhouette breaks apart into a trail of soft,
 * organic wave-foam/jellyfish-like blobs colored by sampling the live
 * camera feed, revealing the real video behind it as you move. Automatically
 * switches the background to the live camera when selected (the effect only
 * reads as intended against the real video, not a black background).
 */
export class DissolveMode {
  readonly mesh: THREE.InstancedMesh;
  readonly material: DissolveMaterial;

  private sceneManager: SceneManager;
  private videoEl: HTMLVideoElement;
  private backgroundLayer: BackgroundLayer;
  private system = new DissolveSystem();
  private sampler = new VideoColorSampler();
  private dummy = new THREE.Object3D();
  private gradedColor = new THREE.Color();

  constructor(sceneManager: SceneManager, videoEl: HTMLVideoElement, backgroundLayer: BackgroundLayer) {
    this.sceneManager = sceneManager;
    this.videoEl = videoEl;
    this.backgroundLayer = backgroundLayer;
    this.material = new DissolveMaterial();

    const geometry = new THREE.PlaneGeometry(2, 2);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    const alphas = new Float32Array(MAX_PARTICLES).fill(0);
    const seeds = new Float32Array(MAX_PARTICLES);
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1).setUsage(THREE.DynamicDrawUsage));

    this.mesh = new THREE.InstancedMesh(geometry, this.material, MAX_PARTICLES);
    this.mesh.position.z = -0.1;
    this.mesh.visible = false;
    // Instances scatter far from the base 2x2 plane's own bounds; without this,
    // frustum culling can misjudge the (uncomputed) instanced bounding volume
    // and skip rendering the object entirely — confirmed via direct testing
    // (the shader program never even got compiled until this was set).
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
    this.sampler.update(this.videoEl);
    this.system.update(poseTracker, this.sceneManager, this.sampler, dt);

    const colorAttr = this.mesh.geometry.attributes.aColor as THREE.BufferAttribute;
    const alphaAttr = this.mesh.geometry.attributes.aAlpha as THREE.BufferAttribute;
    const seedAttr = this.mesh.geometry.attributes.aSeed as THREE.BufferAttribute;
    const particles = this.system.particles;
    const palette = appState.palette;

    let i = 0;
    for (const p of particles) {
      if (i >= MAX_PARTICLES) break;
      const scale = this.system.getScale(p);
      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.rotation.z = p.seed * 6.283;
      this.dummy.scale.set(scale, scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      // Grade the video-sampled particle color toward the app palette (by luminance) so Dissolve reflects palette choice too, instead of always showing raw video color.
      const luminance = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
      paletteColorAt(luminance, palette, this.gradedColor);
      colorAttr.setXYZ(
        i,
        THREE.MathUtils.lerp(p.r, this.gradedColor.r, PALETTE_GRADE_AMOUNT),
        THREE.MathUtils.lerp(p.g, this.gradedColor.g, PALETTE_GRADE_AMOUNT),
        THREE.MathUtils.lerp(p.b, this.gradedColor.b, PALETTE_GRADE_AMOUNT),
      );
      alphaAttr.setX(i, this.system.getAlpha(p));
      seedAttr.setX(i, p.seed);
      i++;
    }
    for (; i < MAX_PARTICLES; i++) {
      this.dummy.position.set(0, 0, -10);
      this.dummy.scale.set(0, 0, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      alphaAttr.setX(i, 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    seedAttr.needsUpdate = true;
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
