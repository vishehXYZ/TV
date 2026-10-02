import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { MandalaCanvasRenderer } from '../generators/mandala/MandalaCanvasRenderer';

/**
 * Mode "Mandala" — a true kaleidoscope of your own movement: each tracked
 * hand/elbow/ankle/nose trail is mirrored about your body center and
 * fold-rotated around the screen, drawn as soft fading additive light
 * trails (ported from the Traxa app's mandala renderer). With no body in
 * frame but music playing, a few virtual points orbit gently — amplitude
 * and speed driven by the live audio level — so it keeps dancing from
 * sound alone instead of sitting static.
 */
export class MandalaMode {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  private renderer: MandalaCanvasRenderer;
  private sceneManager: SceneManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.renderer = new MandalaCanvasRenderer(sceneManager.aspect);

    this.material = new THREE.MeshBasicMaterial({
      map: this.renderer.texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -0.5;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  update(
    poseTracker: PoseTracker,
    appState: AppState,
    elapsedSeconds: number,
    audio: { kick: number; mid: number; treble: number },
  ): void {
    const aspect = this.sceneManager.aspect;
    this.mesh.scale.set(aspect, 1, 1);
    const energy = Math.min(poseTracker.state.energy * 6, 1.5);
    this.renderer.update(poseTracker, appState, elapsedSeconds, energy, audio);
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
