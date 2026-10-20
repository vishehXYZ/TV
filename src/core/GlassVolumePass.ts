import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface GlassVolumeSettings {
  enabled: boolean; shape: string; x: number; y: number;
  width: number; height: number; depth: number;
  rotateX: number; rotateY: number; rotateZ: number;
  opacity: number; refraction: number; edge: number; color: string;
  usePalette: boolean; clip: boolean; perspective: number; rearEdges: number;
}

/** Perspective ray-marched solid glass, composited after the art and paper background. */
export class GlassVolumePass extends ShaderPass {
  private rotation = new THREE.Matrix4();
  private euler = new THREE.Euler();
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null }, uAspect: { value: 1 }, uShape: { value: 0 },
        uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(0.65, 0.85, 0.5) },
        uWorldRotation: { value: new THREE.Matrix3() }, uPerspective: { value: 0.8 }, uRearEdges: { value: 0.45 }, uResolution: { value: new THREE.Vector2(1280,720) }, uRotation: { value: new THREE.Matrix3() }, uOpacity: { value: 0.35 },
        uRefraction: { value: 0.025 }, uEdge: { value: 0.7 },
        uColor: { value: new THREE.Color('#dddddd') }, uClip: { value: 0 }, uWhite: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uAspect,uShape,uOpacity,uRefraction,uEdge,uClip,uWhite;
        uniform vec3 uCenter,uSize,uColor;
        uniform mat3 uRotation,uWorldRotation;
        uniform float uPerspective,uRearEdges; uniform vec2 uResolution;
        varying vec2 vUv;
        float surface(vec3 world){
          vec3 p=uRotation*(world-uCenter);
          if(uShape>1.5){
            vec3 q=abs(p)-uSize;
            return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
          }
          vec3 n=p/uSize;
          if(uShape<0.5){float taper=clamp(1.0-0.22*n.y,0.65,1.35);n.xz/=taper;}
          return (length(n)-1.0)*min(uSize.x,min(uSize.y,uSize.z))*0.65;
        }
        vec3 normalAt(vec3 p){
          vec2 e=vec2(0.002,0.0);
          return normalize(vec3(surface(p+e.xyy)-surface(p-e.xyy),surface(p+e.yxy)-surface(p-e.yxy),surface(p+e.yyx)-surface(p-e.yyx)));
        }
        float hit(vec3 origin,vec3 direction){
          float t=0.0;
          for(int i=0;i<96;i++){
            float d=surface(origin+direction*t);
            if(d<0.0015)return t;
            t+=max(d,0.001);
            if(t>20.0)break;
          }
          return -1.0;
        }
        vec2 projectCorner(vec3 local){
          vec3 world=uWorldRotation*local+uCenter;
          float projection=1.0/(1.0-world.z*uPerspective/5.0);
          return world.xy*projection;
        }
        float segment(vec2 p,vec2 a,vec2 b){
          vec2 d=b-a;
          return length(p-a-d*clamp(dot(p-a,d)/max(dot(d,d),0.000001),0.0,1.0));
        }
        float boxEdges(vec2 screen){
          float result=0.0;
          float pixel=2.0/uResolution.y;
          for(int axis=0;axis<3;axis++){
            for(int a=0;a<2;a++){
              for(int b=0;b<2;b++){
                float sa=float(a)*2.0-1.0; float sb=float(b)*2.0-1.0;
                vec3 start; vec3 end;
                if(axis==0){start=vec3(-uSize.x,sa*uSize.y,sb*uSize.z);end=vec3(uSize.x,sa*uSize.y,sb*uSize.z);}
                else if(axis==1){start=vec3(sa*uSize.x,-uSize.y,sb*uSize.z);end=vec3(sa*uSize.x,uSize.y,sb*uSize.z);}
                else{start=vec3(sa*uSize.x,sb*uSize.y,-uSize.z);end=vec3(sa*uSize.x,sb*uSize.y,uSize.z);}
                float z=(uWorldRotation*((start+end)*0.5)).z;
                float front=smoothstep(-0.08,0.08,z);
                float visibility=mix(uRearEdges,1.0,front);
                float distance=segment(screen,projectCorner(start),projectCorner(end));
                float line=1.0-smoothstep(pixel*0.7,pixel*2.1,distance);
                float halo=exp(-distance*distance/(pixel*pixel*24.0))*0.13;
                result=max(result,(line+halo)*visibility);
              }
            }
          }
          return clamp(result*uEdge,0.0,1.0);
        }
        void main(){
          vec4 source=texture2D(tDiffuse,vUv);
          vec2 screen=vec2((vUv.x-0.5)*2.0*uAspect,(vUv.y-0.5)*2.0);
          vec3 origin=vec3(screen*(1.0-6.0*uPerspective/5.0),6.0);
          vec3 direction=normalize(vec3(screen*uPerspective/5.0,-1.0));
          float frame=uShape>1.5?boxEdges(screen):0.0;
          vec3 rim=mix(uColor,uColor*0.18,uWhite);
          float t=hit(origin,direction);
          if(t<0.0){
            vec3 outside=mix(source.rgb,mix(vec3(0.001518,0.001518,0.003035),vec3(1.0),uWhite),uClip);
            gl_FragColor=vec4(mix(outside,rim,frame*uOpacity),source.a);return;
          }
          vec3 p=origin+direction*t;
          vec3 n=normalAt(p);
          float fresnel=pow(1.0-abs(dot(n,-direction)),2.2);
          vec3 farOrigin=origin+direction*16.0;
          float backT=hit(farOrigin,-direction);
          vec3 backN=normalAt(farOrigin-direction*max(backT,0.0));
          float thickness=max(0.0,16.0-t-backT);
          vec2 shift=n.xy*uRefraction*(0.4+thickness)*vec2(1.0/uAspect,1.0);
          vec3 art=texture2D(tDiffuse,clamp(vUv+shift,vec2(0.001),vec2(0.999))).rgb;
          // Opposed softbox reflections make depth legible without concealing the artwork.
          float frontLight=pow(max(dot(n,normalize(vec3(-0.6,0.8,1.0))),0.0),36.0);
          float softReflection=pow(max(dot(n,normalize(vec3(-0.8,0.3,0.6))),0.0),8.0);
          float backLight=pow(max(dot(backN,normalize(vec3(0.7,0.4,-1.0))),0.0),48.0);
          vec3 glass=mix(art,art*uColor,uOpacity*0.16);
          glass=mix(glass,uColor,(fresnel*uEdge*0.85+backLight*0.12)*uOpacity);
          glass=mix(glass,vec3(1.0),frontLight*uOpacity*0.65);
          // Dark rim is readable on paper; bright rim is readable on a dark stage.
          glass=mix(glass,rim,softReflection*uOpacity*0.14);
          glass=mix(glass,rim,clamp(fresnel*uEdge,0.0,1.0)*uOpacity);
          glass=mix(glass,rim,frame*uOpacity);
          gl_FragColor=vec4(glass,source.a);
        }`,
    });
    this.enabled = false;
  }

  override setSize(width: number, height: number): void { this.uniforms.uResolution!.value.set(width, height); }

  configure(s: GlassVolumeSettings, aspect: number, white: boolean, paletteColor: THREE.Color): void {
    this.enabled = s.enabled;
    this.uniforms.uAspect!.value = aspect;
    this.uniforms.uShape!.value = s.shape === 'Box' ? 2 : s.shape === 'Sphere' ? 1 : 0;
    this.uniforms.uCenter!.value.set(s.x * aspect, s.y, 0);
    this.uniforms.uSize!.value.set(s.width / 2, s.height / 2, s.depth / 2);
    this.euler.set(THREE.MathUtils.degToRad(s.rotateX), THREE.MathUtils.degToRad(s.rotateY), THREE.MathUtils.degToRad(s.rotateZ));
    this.rotation.makeRotationFromEuler(this.euler);
    this.uniforms.uWorldRotation!.value.setFromMatrix4(this.rotation);
    this.rotation.invert();
    this.uniforms.uRotation!.value.setFromMatrix4(this.rotation);
    this.uniforms.uColor!.value.copy(s.usePalette ? paletteColor : new THREE.Color(s.color));
    this.uniforms.uPerspective!.value = s.perspective;
    this.uniforms.uRearEdges!.value = s.rearEdges;
    this.uniforms.uOpacity!.value = s.opacity;
    this.uniforms.uRefraction!.value = s.refraction * 0.05;
    this.uniforms.uEdge!.value = s.edge;
    this.uniforms.uClip!.value = s.clip ? 1 : 0;
    this.uniforms.uWhite!.value = white ? 1 : 0;
  }
}
