import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export interface GlassVolumeSettings {
  enabled: boolean; shape: string; x: number; y: number;
  width: number; height: number; depth: number;
  rotateX: number; rotateY: number; rotateZ: number;
  opacity: number; refraction: number; edge: number; color: string;
  usePalette: boolean; clip: boolean;
}

/** Orthographic ray-marched solid glass, composited after the art and paper background. */
export class GlassVolumePass extends ShaderPass {
  private rotation = new THREE.Matrix4();
  private euler = new THREE.Euler();
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null }, uAspect: { value: 1 }, uShape: { value: 0 },
        uCenter: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(0.65, 0.85, 0.5) },
        uRotation: { value: new THREE.Matrix3() }, uOpacity: { value: 0.35 },
        uRefraction: { value: 0.025 }, uEdge: { value: 0.7 },
        uColor: { value: new THREE.Color('#a8dce8') }, uClip: { value: 0 }, uWhite: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uAspect,uShape,uOpacity,uRefraction,uEdge,uClip,uWhite;
        uniform vec3 uCenter,uSize,uColor;
        uniform mat3 uRotation;
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
            if(t>12.0)break;
          }
          return -1.0;
        }
        void main(){
          vec4 source=texture2D(tDiffuse,vUv);
          vec3 origin=vec3((vUv.x-0.5)*2.0*uAspect,(vUv.y-0.5)*2.0,6.0);
          float t=hit(origin,vec3(0.0,0.0,-1.0));
          if(t<0.0){gl_FragColor=vec4(mix(source.rgb,mix(vec3(0.001518,0.001518,0.003035),vec3(1.0),uWhite),uClip),source.a);return;}
          vec3 p=origin+vec3(0.0,0.0,-t);
          vec3 n=normalAt(p);
          float fresnel=pow(1.0-abs(n.z),2.2);
          float backT=hit(vec3(origin.xy,-6.0),vec3(0.0,0.0,1.0));
          vec3 backN=normalAt(vec3(origin.xy,-6.0+max(backT,0.0)));
          float thickness=max(0.0,12.0-t-backT);
          vec2 shift=n.xy*uRefraction*(0.4+thickness)*vec2(1.0/uAspect,1.0);
          vec3 art=texture2D(tDiffuse,clamp(vUv+shift,vec2(0.001),vec2(0.999))).rgb;
          // Opposed softbox reflections make depth legible without concealing the artwork.
          float frontLight=pow(max(dot(n,normalize(vec3(-0.6,0.8,1.0))),0.0),36.0);
          float backLight=pow(max(dot(backN,normalize(vec3(0.7,0.4,-1.0))),0.0),48.0);
          vec3 glass=mix(art,art*uColor,uOpacity*0.16);
          glass=mix(glass,uColor,(fresnel*uEdge*0.85+backLight*0.12)*uOpacity);
          glass=mix(glass,vec3(1.0),frontLight*uOpacity*0.65);
          // Dark rim is readable on paper; bright rim is readable on a dark stage.
          vec3 rim=mix(uColor,uColor*0.32,uWhite);
          glass=mix(glass,rim,clamp(fresnel*uEdge,0.0,1.0)*uOpacity);
          gl_FragColor=vec4(glass,source.a);
        }`,
    });
    this.enabled = false;
  }

  configure(s: GlassVolumeSettings, aspect: number, white: boolean, paletteColor: THREE.Color): void {
    this.enabled = s.enabled;
    this.uniforms.uAspect!.value = aspect;
    this.uniforms.uShape!.value = s.shape === 'Box' ? 2 : s.shape === 'Sphere' ? 1 : 0;
    this.uniforms.uCenter!.value.set(s.x * aspect, s.y, 0);
    this.uniforms.uSize!.value.set(s.width / 2, s.height / 2, s.depth / 2);
    this.euler.set(THREE.MathUtils.degToRad(s.rotateX), THREE.MathUtils.degToRad(s.rotateY), THREE.MathUtils.degToRad(s.rotateZ));
    this.rotation.makeRotationFromEuler(this.euler).invert();
    this.uniforms.uRotation!.value.setFromMatrix4(this.rotation);
    this.uniforms.uColor!.value.copy(s.usePalette ? paletteColor : new THREE.Color(s.color));
    this.uniforms.uOpacity!.value = s.opacity;
    this.uniforms.uRefraction!.value = s.refraction * 0.05;
    this.uniforms.uEdge!.value = s.edge;
    this.uniforms.uClip!.value = s.clip ? 1 : 0;
    this.uniforms.uWhite!.value = white ? 1 : 0;
  }
}
