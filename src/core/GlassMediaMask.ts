import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { GlassVolumePass } from './GlassVolumePass';

/** Same projected volume as the glass compositor, shared by media and paper composition. */
export const glassMediaMaskGLSL = `
uniform float uGAspect,uGShape,uGPerspective,uMediaInside,uGLegacyEnabled;
uniform sampler2D uObjectMask;
uniform vec3 uGCenter,uGSize; uniform mat3 uGRotation; uniform vec2 uGResolution;
float gSurface(vec3 world){
 vec3 p=uGRotation*(world-uGCenter);
 if(uGShape>1.5){vec3 q=abs(p)-uGSize;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}
 vec3 n=p/uGSize;
 if(uGShape<0.5)n.xz/=clamp(1.0-0.22*n.y,0.65,1.35);
 return (length(n)-1.0)*min(uGSize.x,min(uGSize.y,uGSize.z))*0.65;
}
bool legacyGlassContains(vec2 uv){
 if(uGLegacyEnabled<0.5)return false;
 vec2 screen=vec2((uv.x-0.5)*2.0*uGAspect,(uv.y-0.5)*2.0);
 vec3 origin=vec3(screen*(1.0-6.0*uGPerspective/5.0),6.0);
 vec3 direction=normalize(vec3(screen*uGPerspective/5.0,-1.0));
 float t=0.0;
 for(int i=0;i<96;i++){float d=gSurface(origin+direction*t);if(d<0.0015)return true;t+=max(d,0.001);if(t>20.0)break;}
 return false;
}
bool glassContains(vec2 uv){return texture2D(uObjectMask,uv).r>0.5 || legacyGlassContains(uv);}
`;
export function glassMediaUniforms(glass: GlassVolumePass): Record<string, THREE.IUniform> {
 const u=glass.uniforms;
 return {uGAspect:u.uAspect!,uGShape:u.uShape!,uGPerspective:u.uPerspective!,uGCenter:u.uCenter!,uGSize:u.uSize!,uGRotation:u.uRotation!,uGResolution:u.uResolution!,uMediaInside:{value:0},uGLegacyEnabled:{value:0},uObjectMask:{value:null}};
}
export function clipMediaMaterial(material: THREE.ShaderMaterial, uniforms: Record<string,THREE.IUniform>): void {
 Object.assign(material.uniforms,uniforms);
 material.fragmentShader=glassMediaMaskGLSL+material.fragmentShader.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main(){ if(uMediaInside>0.5 && !glassContains(gl_FragCoord.xy/uGResolution)) discard;');
 material.needsUpdate=true;
}

/** ShaderPass clones plain shader specifications; scopes must retain live uniform/target references. */
export function sharedScopePass(spec: THREE.ShaderMaterialParameters): ShaderPass {
 return new ShaderPass(new THREE.ShaderMaterial(spec));
}
