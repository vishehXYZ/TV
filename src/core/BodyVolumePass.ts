import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import type { PoseState } from '../tracking/PoseState';

/** A visible-surface depth estimate, textured with the active effects. It does not invent a back view. */
export class BodyVolumePass extends Pass {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,20);
  readonly material: THREE.ShaderMaterial;
  readonly mesh: THREE.Mesh;
  private readonly mask = new SegmentationMaskTexture();
  private readonly copyMaterial = new THREE.ShaderMaterial({
    uniforms:{tDiffuse:{value:null}},depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){gl_FragColor=texture2D(tDiffuse,vUv);}',
  });
  private readonly copyQuad = new FullScreenQuad(this.copyMaterial);
  constructor(){
    super();this.enabled=false;this.camera.position.z=5;
    this.material=new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,transparent:true,toneMapped:false,
      uniforms:{tDiffuse:{value:null},uMask:{value:null},uRepeat:{value:new THREE.Vector2(-1,1)},uOffset:{value:new THREE.Vector2(1,0)},uAspect:{value:1},uDepth:{value:1},uLighting:{value:.75},uLightAngle:{value:-35},uJoints:{value:Array.from({length:13},()=>new THREE.Vector4(100,100,0,.1))}},
      vertexShader:`
        uniform sampler2D uMask;uniform vec2 uRepeat,uOffset;uniform float uAspect,uDepth;
        uniform vec4 uJoints[13];varying vec2 vUv;varying vec3 vBodyNormal;
        float bodyMask(vec2 uv){return texture2D(uMask,uv*uRepeat+uOffset).r;}
        float heightAt(vec2 uv){
          float m=bodyMask(uv);if(m<.1)return 0.;
          vec2 p=(uv-.5)*vec2(2.*uAspect,2.);
          float total=0.,z=0.,roundness=0.;
          for(int i=0;i<13;i++){
            vec2 d=p-uJoints[i].xy;
            float w=exp(-dot(d,d)/(uJoints[i].w*uJoints[i].w));
            total+=w;z+=w*uJoints[i].z;roundness=max(roundness,w);
          }
          float softness=(bodyMask(uv+vec2(.025/uAspect,0.))+bodyMask(uv-vec2(.025/uAspect,0.))+bodyMask(uv+vec2(0.,.025))+bodyMask(uv-vec2(0.,.025)))*.25;
          return uDepth*m*(.12*softness+.26*sqrt(roundness)+clamp(z/max(total,.001),-.3,.3));
        }
        void main(){
          vUv=uv;float e=.006;
          float h=heightAt(uv);
          float dx=(heightAt(uv+vec2(e,0.))-heightAt(uv-vec2(e,0.)))/(4.*e*uAspect);
          float dy=(heightAt(uv+vec2(0.,e))-heightAt(uv-vec2(0.,e)))/(4.*e);
          vBodyNormal=normalize(vec3(-dx,-dy,1.));
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position.x*uAspect,position.y,h,1.);
        }`,
      fragmentShader:`
        uniform sampler2D tDiffuse,uMask;uniform vec2 uRepeat,uOffset;uniform float uLighting,uLightAngle;
        varying vec2 vUv;varying vec3 vBodyNormal;
        void main(){
          float m=smoothstep(.35,.65,texture2D(uMask,vUv*uRepeat+uOffset).r);if(m<.005)discard;
          vec3 n=normalize(vBodyNormal);float a=radians(uLightAngle);
          vec3 light=normalize(vec3(sin(a),.55,cos(a)));
          float diffuse=.42+.65*max(dot(n,light),0.);
          float highlight=pow(max(dot(reflect(-light,n),vec3(0.,0.,1.)),0.),25.)*.09;
          vec4 c=texture2D(tDiffuse,vUv);
          vec3 raised=c.rgb*mix(1.,diffuse,uLighting)+vec3(highlight*uLighting);
          gl_FragColor=vec4(raised,m);
        }`,
    });
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2,72,96),this.material);this.mesh.frustumCulled=false;this.scene.add(this.mesh);
  }
  configure(settings:{enabled:boolean;depth:number;lighting:number;lightAngle:number},pose:PoseState,aspect:number):void{
    this.enabled=settings.enabled&&settings.depth>0&&pose.hasDetection&&Boolean(pose.segmentationMask);
    if(!this.enabled)return;
    const mask=this.mask.update(pose);this.material.uniforms.uMask!.value=mask;
    const sourceAspect=this.mask.width/this.mask.height;
    const rx=sourceAspect>aspect?aspect/sourceAspect:1,ry=sourceAspect>aspect?1:sourceAspect/aspect;
    (this.material.uniforms.uRepeat!.value as THREE.Vector2).set(-rx,ry);
    (this.material.uniforms.uOffset!.value as THREE.Vector2).set((1+rx)/2,(1-ry)/2);
    this.material.uniforms.uAspect!.value=aspect;this.material.uniforms.uDepth!.value=settings.depth;
    this.material.uniforms.uLighting!.value=settings.lighting;this.material.uniforms.uLightAngle!.value=settings.lightAngle;
    this.camera.left=-aspect;this.camera.right=aspect;this.camera.updateProjectionMatrix();
    const joints=this.material.uniforms.uJoints!.value as THREE.Vector4[];
    const indices=[0,11,12,13,14,15,16,23,24,25,26,27,28];
    for(let i=0;i<indices.length;i++){
      const point=pose.landmarks[indices[i]!]!;
      if(!point||point.visibility<.35){joints[i]!.set(100,100,0,.1);continue;}
      const x=(.5-point.x)/rx*2*aspect,y=(.5-point.y)/ry*2;
      const radius=i===0?.18:[1,2,7,8].includes(i)?.32:.15;
      joints[i]!.set(x,y,THREE.MathUtils.clamp(-point.z*.5,-.3,.3),radius);
    }
  }
  override render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget):void{
    const autoClear=renderer.autoClear,target=renderer.getRenderTarget();
    this.copyMaterial.uniforms.tDiffuse!.value=readBuffer.texture;this.material.uniforms.tDiffuse!.value=readBuffer.texture;
    try{renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.copyQuad.render(renderer);renderer.autoClear=false;renderer.render(this.scene,this.camera);}
    finally{renderer.autoClear=autoClear;renderer.setRenderTarget(target);}
  }
  override dispose():void{this.mask.dispose();this.mesh.geometry.dispose();this.material.dispose();this.copyMaterial.dispose();this.copyQuad.dispose();}
}
