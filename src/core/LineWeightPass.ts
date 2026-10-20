import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/** Screen-space dilation/erosion: one consistent line-weight control across all visual modes. */
export class LineWeightPass extends ShaderPass {
  constructor() {
    super({
      uniforms: { tDiffuse: { value: null }, uPixel: { value: new THREE.Vector2(1, 1) }, uAmount: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uPixel; uniform float uAmount; varying vec2 vUv;
        float brightness(vec3 c){return max(c.r,max(c.g,c.b));}
        void main(){
          vec4 original=texture2D(tDiffuse,vUv);
          vec3 result=original.rgb;
          float score=brightness(result);
          for(int ring=1;ring<=3;ring++){
            float radius=abs(uAmount)*float(ring)/3.0;
            for(int i=0;i<8;i++){
              float angle=float(i)*0.7853981634;
              vec2 offset=vec2(cos(angle),sin(angle))*uPixel*radius;
              vec3 candidate=texture2D(tDiffuse,clamp(vUv+offset,vec2(0.0),vec2(1.0))).rgb;
              float candidateScore=brightness(candidate);
              if((uAmount>0.0 && candidateScore>score)||(uAmount<0.0 && candidateScore<score)){result=candidate;score=candidateScore;}
            }
          }
          gl_FragColor=vec4(result,original.a);
        }`,
    });
    this.enabled = false;
  }
  override setSize(width: number, height: number): void {
    // Fixed relative to frame height, so exported thickness matches preview.
    const unit = height / 720;
    this.uniforms.uPixel!.value.set(unit / width, unit / height);
  }
  configure(weight: number): void {
    this.enabled = Math.abs(weight - 1) > 0.001;
    this.uniforms.uAmount!.value = weight >= 1 ? (weight - 1) * 2.5 : (weight - 1) * 1.5;
  }
}
