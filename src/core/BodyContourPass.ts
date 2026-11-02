import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import type { Landmark, PoseState } from '../tracking/PoseState';

export interface BodyContourSettings {
  enabled: boolean; outer: boolean; limbs: boolean; hands: boolean;
  width: number; opacity: number; sensitivity: number; usePalette: boolean; color: string;
}
/** Silhouette plus real camera-image edges near tracked limbs. Pose only defines search regions. */
export class BodyContourPass extends ShaderPass {
  private readonly mask = new SegmentationMaskTexture();
  private camera: THREE.VideoTexture | null = null;
  private video: HTMLVideoElement | null = null;
  constructor(){
    super(new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{tDiffuse:{value:null},uCamera:{value:null},uHasCamera:{value:0},uCameraResolution:{value:new THREE.Vector2(1280,720)},uThreshold:{value:.11},uMask:{value:null},uHasMask:{value:0},uRepeat:{value:new THREE.Vector2(-1,1)},uOffset:{value:new THREE.Vector2(1,0)},uAspect:{value:1},uResolution:{value:new THREE.Vector2(1280,720)},uWidth:{value:2},uOpacity:{value:.9},uOuter:{value:1},uLimbs:{value:1},uHands:{value:1},uColor:{value:new THREE.Color()},uA:{value:Array.from({length:12},()=>new THREE.Vector4())},uB:{value:Array.from({length:12},()=>new THREE.Vector4())}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
        uniform sampler2D tDiffuse,uMask,uCamera;
        uniform vec2 uRepeat,uOffset,uResolution,uCameraResolution;
        uniform float uAspect,uWidth,uOpacity,uHasMask,uHasCamera,uThreshold,uOuter,uLimbs,uHands;
        uniform vec3 uColor;uniform vec4 uA[12],uB[12];varying vec2 vUv;
        float maskAt(vec2 p){
          vec2 uv=p*uRepeat+uOffset;
          if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)return 0.;
          return texture2D(uMask,uv).r;
        }
        float silhouette(float radius){
          if(uHasMask<.5||uOuter<.5)return 0.;
          vec2 e=vec2(radius)/uResolution;
          float lo=maskAt(vUv),hi=lo;
          for(int i=0;i<8;i++){
            float a=float(i)*.78539816;
            float m=maskAt(vUv+vec2(cos(a),sin(a))*e);
            lo=min(lo,m);hi=max(hi,m);
          }
          return (1.-smoothstep(.45,.55,lo))*smoothstep(.45,.55,hi);
        }
        float capsule(vec2 p,vec4 a,vec4 b){
          if(a.w<.5||b.w<.5)return 1000.;
          vec2 v=b.xy-a.xy;
          float t=clamp(dot(p-a.xy,v)/max(dot(v,v),.000001),0.,1.);
          return length(p-mix(a.xy,b.xy,t))-mix(a.z,b.z,t);
        }
        float regionAt(vec2 uv){
          vec2 p=(uv-.5)*vec2(2.*uAspect,2.);
          float region=0.;
          for(int i=0;i<12;i++){
            if((i<8&&uLimbs>.5)||(i>=8&&uHands>.5)){
              float d=capsule(p,uA[i],uB[i]);
              region=max(region,1.-smoothstep(.02,.08,d));
            }
          }
          return region;
        }
        float cameraEdge(vec2 uv){
          vec2 source=uv*uRepeat+uOffset;
          vec2 e=vec2(1.5)/uCameraResolution;
          vec3 dx=texture2D(uCamera,source+vec2(e.x,0.)).rgb-texture2D(uCamera,source-vec2(e.x,0.)).rgb;
          vec3 dy=texture2D(uCamera,source+vec2(0.,e.y)).rgb-texture2D(uCamera,source-vec2(0.,e.y)).rgb;
          float gradient=sqrt(dot(dx,dx)+dot(dy,dy))*.57735;
          return smoothstep(uThreshold,uThreshold*2.,gradient);
        }
        float internalEdge(float radius){
          if(uHasCamera<.5||uHasMask<.5)return 0.;
          float region=regionAt(vUv)*smoothstep(.45,.65,maskAt(vUv));
          if(region<.001)return 0.;
          float edge=cameraEdge(vUv);
          vec2 pixel=vec2(radius*.5)/uResolution;
          edge=max(edge,cameraEdge(vUv+vec2(pixel.x,0.)));
          edge=max(edge,cameraEdge(vUv-vec2(pixel.x,0.)));
          edge=max(edge,cameraEdge(vUv+vec2(0.,pixel.y)));
          edge=max(edge,cameraEdge(vUv-vec2(0.,pixel.y)));
          return edge*region;
        }
        void main(){
          vec4 source=texture2D(tDiffuse,vUv);
          float core=max(silhouette(uWidth*.5),internalEdge(uWidth));
          float halo=max(silhouette(uWidth*.5+1.5),internalEdge(uWidth+2.5));
          vec3 contrast=dot(uColor,vec3(.2126,.7152,.0722))>.4?vec3(.025):vec3(.95);
          vec3 c=mix(source.rgb,contrast,halo*uOpacity*.65);
          c=mix(c,uColor,core*uOpacity);
          gl_FragColor=vec4(c,source.a);
        }`,
    }));
    this.enabled=false;
  }
  override setSize(width:number,height:number):void{(this.uniforms.uResolution!.value as THREE.Vector2).set(width,height);}
  configure(settings:BodyContourSettings,pose:PoseState,aspect:number,paletteColor:THREE.Color,video?:HTMLVideoElement):void{
    this.enabled=settings.enabled&&pose.hasDetection&&settings.opacity>0;
    if(!this.enabled){this.uniforms.uHasCamera!.value=0;return;}
    const texture=this.mask.update(pose);this.uniforms.uMask!.value=texture;this.uniforms.uHasMask!.value=texture?1:0;
    const ready=Boolean(video&&video.readyState>=2&&video.videoWidth>0&&!video.paused&&!video.ended);
    if(ready&&video!==this.video){this.camera?.dispose();this.video=video!;this.camera=new THREE.VideoTexture(video!);this.camera.colorSpace=THREE.SRGBColorSpace;}
    this.uniforms.uCamera!.value=ready?this.camera:null;this.uniforms.uHasCamera!.value=ready?1:0;
    if(ready)(this.uniforms.uCameraResolution!.value as THREE.Vector2).set(video!.videoWidth,video!.videoHeight);
    this.uniforms.uThreshold!.value=THREE.MathUtils.lerp(.22,.025,THREE.MathUtils.clamp(settings.sensitivity,0,1));
    const sourceAspect=ready?video!.videoWidth/video!.videoHeight:pose.segmentationMask?this.mask.width/this.mask.height:aspect;
    const rx=sourceAspect>aspect?aspect/sourceAspect:1,ry=sourceAspect>aspect?1:sourceAspect/aspect;
    (this.uniforms.uRepeat!.value as THREE.Vector2).set(-rx,ry);
    (this.uniforms.uOffset!.value as THREE.Vector2).set((1+rx)/2,(1-ry)/2);
    this.uniforms.uAspect!.value=aspect;this.uniforms.uWidth!.value=settings.width;this.uniforms.uOpacity!.value=settings.opacity;
    this.uniforms.uOuter!.value=settings.outer?1:0;this.uniforms.uLimbs!.value=settings.limbs?1:0;this.uniforms.uHands!.value=settings.hands?1:0;
    const color=this.uniforms.uColor!.value as THREE.Color;if(settings.usePalette)color.copy(paletteColor);else color.set(settings.color);
    const aa=this.uniforms.uA!.value as THREE.Vector4[],bb=this.uniforms.uB!.value as THREE.Vector4[];
    const stage=(point:Landmark)=>new THREE.Vector2((.5-point.x)/rx*2*aspect,(.5-point.y)/ry*2);
    const valid=(point:Landmark|undefined):point is Landmark=>Boolean(point&&point.visibility>=.35&&Number.isFinite(point.x)&&Number.isFinite(point.y));
    const l=pose.landmarks[11],r=pose.landmarks[12];
    const shoulder=valid(l)&&valid(r)?THREE.MathUtils.clamp(stage(l).distanceTo(stage(r)),.18,1.8):.6;
    const pairs=[[11,13,.115,.09],[13,15,.09,.055],[12,14,.115,.09],[14,16,.09,.055],[23,25,.17,.12],[25,27,.12,.07],[24,26,.17,.12],[26,28,.12,.07],[15,19,.06,.095],[16,20,.06,.095],[27,31,.065,.075],[28,32,.065,.075]];
    for(let i=0;i<pairs.length;i++){
      const [a,b,ra,rb]=pairs[i]!;const start=pose.landmarks[a!]!,end=pose.landmarks[b!]!;
      aa[i]!.set(0,0,0,0);bb[i]!.set(0,0,0,0);
      if(!valid(start)||!valid(end))continue;
      const p=stage(start),q=stage(end);aa[i]!.set(p.x,p.y,shoulder*ra!,1);bb[i]!.set(q.x,q.y,shoulder*rb!,1);
    }
  }
  override dispose():void{this.mask.dispose();this.camera?.dispose();super.dispose();}
}
