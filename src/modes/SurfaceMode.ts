import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { AppState } from '../core/AppState';
import type { PoseTracker } from '../tracking/PoseTracker';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import vertexShader from '../generators/chroma/chroma.vert.glsl';
import fragmentShader from '../generators/surface/surface.frag.glsl';
export class SurfaceMode {
 private mask = new SegmentationMaskTexture();
 private material: THREE.ShaderMaterial;
 private mesh: THREE.Mesh;
 private scene: SceneManager;
 constructor(scene: SceneManager, state: AppState, style: number) {
  this.scene = scene;
  this.material = new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false, uniforms:{
   uMask:{value:null},uMaskResolution:{value:new THREE.Vector2(1,1)},uAspect:{value:1},uHasMask:{value:0},uTime:{value:0},uEnergy:{value:0},uStyle:{value:style},uPalette:{value:state.palette}
  }});
  this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material); this.mesh.position.z = -0.4; this.mesh.visible = false; scene.scene.add(this.mesh);
 }
 setVisible(v: boolean): void { this.mesh.visible = v; }
 update(tracker: PoseTracker, state: AppState, time: number): void {
  this.mesh.scale.set(this.scene.aspect,1,1); const u=this.material.uniforms;
  u.uAspect!.value=this.scene.aspect; u.uTime!.value=time; u.uEnergy!.value=Math.min(tracker.state.energy,1); u.uPalette!.value=state.palette;
  const mask=this.mask.update(tracker.state); u.uMask!.value=mask; u.uHasMask!.value=mask && tracker.state.hasDetection ? 1:0; u.uMaskResolution!.value.set(this.mask.width,this.mask.height);
 }
}
