import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { AppState } from '../core/AppState';
import type { PoseTracker } from '../tracking/PoseTracker';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import vertexShader from '../generators/chroma/chroma.vert.glsl';
import maskSample from '../generators/shared/maskSample.glsl';

/** Silhouette effects remain anchored to the current segmentation, with wrist-driven highlights. */
export class BodyFxMode {
  private mask = new SegmentationMaskTexture();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: SceneManager;
  constructor(scene: SceneManager, style: number) {
    this.scene = scene;
    this.material = new THREE.ShaderMaterial({ vertexShader, transparent: true, depthWrite: false,
      uniforms: {
        uMask: { value: null }, uMaskResolution: { value: new THREE.Vector2(1,1) },
        uAspect: { value: 1 }, uHasMask: { value: 0 }, uTime: { value: 0 }, uEnergy: { value: 0 },
        uStyle: { value: style }, uIntensity: { value: 1 }, uScale: { value: 1 },
        uPalette: { value: [] }, uUsePalette: { value: 0 },
        uHands: { value: [new THREE.Vector2(10,10),new THREE.Vector2(10,10)] },
      },
      fragmentShader: `
      uniform sampler2D uMask; uniform vec2 uMaskResolution; uniform float uAspect,uHasMask,uTime,uEnergy,uStyle,uIntensity,uScale;
      uniform vec3 uPalette[5]; uniform float uUsePalette; uniform vec2 uHands[2]; varying vec2 vStagePos;
      ${maskSample}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      vec3 rainbow(float x){
        if(uUsePalette>0.5){float q=fract(x)*4.0; if(q<1.0)return mix(uPalette[0],uPalette[1],q); if(q<2.0)return mix(uPalette[1],uPalette[2],q-1.0); if(q<3.0)return mix(uPalette[2],uPalette[3],q-2.0); return mix(uPalette[3],uPalette[4],q-3.0);}
        return 0.48+0.48*cos(6.28318*(x+vec3(0.0,0.33,0.67)));}
      void main(){
        vec2 p=vStagePos; float t=uTime;
        if(uHasMask<0.5){gl_FragColor=vec4(0.0);return;}
        float body=smoothstep(0.25,0.65,sampleMask(p));
        float inner=smoothstep(0.25,0.65,sampleMask(p+vec2(0.018,0.0)))*smoothstep(0.25,0.65,sampleMask(p-vec2(0.018,0.0)))*smoothstep(0.25,0.65,sampleMask(p+vec2(0.0,0.018)))*smoothstep(0.25,0.65,sampleMask(p-vec2(0.0,0.018)));
        float edge=max(0.0,body-inner);
        float hands=exp(-length(p-uHands[0])*13.0)+exp(-length(p-uHands[1])*13.0);
        vec3 color; float alpha;
        if(uStyle<0.5){
          // Upward advection samples the real body below each flame; nothing is detached from it.
          vec2 q=vec2(p.x*8.0*uScale,p.y*5.0*uScale-t*(2.0+uEnergy*3.0));
          float n=noise(q)+noise(q*2.1)*0.5+noise(q*4.3)*0.25;
          float flicker=0.5+0.5*sin(p.x*23.0+n*6.0+t*3.0);
          float lift=0.06+flicker*(0.07+uEnergy*0.16);
          float plume=smoothstep(0.3,0.65,sampleMask(p-vec2(sin(q.y+n)*0.018,lift)))*(1.0-body);
          float streak=pow(max(0.0,sin(q.x+n*8.0)),3.0);
          color=rainbow(p.x*0.33+n*0.22+t*0.06)*(0.55+streak*0.8)+vec3(1.0,0.65,0.2)*hands*0.35;
          alpha=clamp(body*(0.35+streak*0.6)+edge*0.8+plume*flicker*0.85+hands*body*0.2,0.0,1.0);
        }else if(uStyle<1.5){
          float wave=sin(p.y*7.0*uScale+t*1.6)*0.18+sin(p.x*4.0-t)*0.1;
          float ribbon=pow(0.5+0.5*sin((p.x+wave)*31.0*uScale+t*(1.0+uEnergy*2.0)),9.0);
          color=rainbow(p.y*0.45+t*0.09+wave)*(0.6+ribbon)+vec3(0.15,0.5,0.6)*hands;
          alpha=clamp(body*(0.18+ribbon*0.8)+edge*0.9,0.0,1.0);
        }else{
          vec2 grid=p*vec2(15.0,12.0)*uScale;
          grid.x+=sin(grid.y*0.4+t)*uEnergy*0.65;
          vec2 cell=floor(grid),f=fract(grid);
          float seed=hash(cell);
          float triangle=step(f.x,f.y);
          float cut=smoothstep(0.015,0.06,min(min(f.x,1.0-f.x),min(f.y,1.0-f.y)))*smoothstep(0.01,0.05,abs(f.x-f.y));
          float flash=0.55+0.45*sin(t*(1.0+uEnergy*4.0)+seed*15.0+triangle*2.0);
          color=rainbow(seed+triangle*0.12+t*0.035)*(0.35+flash*0.85);
          alpha=clamp(body*(0.15+cut*flash*0.85)+edge*0.75,0.0,1.0);
        }
        gl_FragColor=vec4(color*uIntensity,alpha);
      }`,
    });
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
    this.mesh.position.z=-0.3;this.mesh.visible=false;scene.scene.add(this.mesh);
  }
  setVisible(visible: boolean): void { this.mesh.visible=visible; }
  update(tracker: PoseTracker,state: AppState,time: number): void {
    this.mesh.scale.set(this.scene.aspect,1,1);
    const u=this.material.uniforms, mask=this.mask.update(tracker.state);
    u.uMask!.value=mask;u.uMaskResolution!.value.set(this.mask.width,this.mask.height);
    u.uHasMask!.value=mask && tracker.state.hasDetection?1:0;u.uAspect!.value=this.scene.aspect;
    u.uTime!.value=time*state.bodyFx.speed;u.uEnergy!.value=Math.min(1,Math.max(0,tracker.state.energy));
    u.uPalette!.value=state.palette;u.uUsePalette!.value=state.bodyFx.usePalette?1:0;
    u.uIntensity!.value=state.bodyFx.intensity;u.uScale!.value=state.bodyFx.scale;
    const hands=u.uHands!.value as THREE.Vector2[];
    [15,16].forEach((index,i)=>{
      const point=tracker.state.landmarks[index];
      if(!tracker.state.hasDetection || !point || point.visibility<0.4){hands[i]!.set(10,10);return;}
      // Same mirrored cover crop as the segmentation helper.
      const maskAspect=this.mask.width/this.mask.height, aspect=this.scene.aspect;
      let x=1-point.x,y=1-point.y;
      if(maskAspect>aspect)x=(x-0.5)*maskAspect/aspect+0.5;
      else y=(y-0.5)*aspect/maskAspect+0.5;
      hands[i]!.set((x-0.5)*2*aspect,(y-0.5)*2);
    });
  }
}
