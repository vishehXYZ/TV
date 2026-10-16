import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export interface MotionDelaySettings {
  enabled: boolean;
  duration: number;
  strength: number;
  echoes: number;
}

const SLOTS = 8;
const vertexShader = 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';

/** Discrete delayed copies of raw frames. Never feeds the composite back into history. */
export class MotionDelayPass extends Pass {
  private targets = Array.from({ length: SLOTS }, () => new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false,
  }));
  private times = Array<number>(SLOTS).fill(-Infinity);
  private cursor = 0;
  private time = 0;
  private lastCapture = -Infinity;
  private settings: MotionDelaySettings = { enabled: false, duration: 2, strength: 0.65, echoes: 6 };
  private signature = '';
  private composite: THREE.ShaderMaterial;
  private copy: THREE.ShaderMaterial;
  private quad: FullScreenQuad;

  constructor() {
    super();
    this.enabled = false;
    const uniforms: Record<string, THREE.IUniform> = { tDiffuse: { value: null } };
    for (let i = 0; i < SLOTS; i++) {
      uniforms[`tHistory${i}`] = { value: this.targets[i]!.texture };
      uniforms[`weight${i}`] = { value: 0 };
    }
    this.composite = new THREE.ShaderMaterial({
      uniforms, vertexShader, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        ${Array.from({ length: SLOTS }, (_, i) => `uniform sampler2D tHistory${i}; uniform float weight${i};`).join('\n')}
        void main(){
          vec4 current=texture2D(tDiffuse,vUv);
          vec3 result=current.rgb;
          ${Array.from({ length: SLOTS }, (_, i) => `if(weight${i}>0.0) result=max(result,texture2D(tHistory${i},vUv).rgb*weight${i});`).join('\n')}
          gl_FragColor=vec4(result,current.a);
        }`,
    });
    this.copy = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null } }, vertexShader,
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){gl_FragColor=texture2D(tDiffuse,vUv);}',
      depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    });
    this.quad = new FullScreenQuad(this.composite);
  }

  configure(settings: MotionDelaySettings, context: string): void {
    const signature = JSON.stringify([settings.enabled, settings.duration, settings.echoes, context]);
    if (signature !== this.signature) this.reset();
    this.signature = signature;
    this.settings = { ...settings };
    this.enabled = settings.enabled;
  }

  reset(): void {
    this.times.fill(-Infinity);
    this.cursor = 0;
    this.lastCapture = -Infinity;
  }

  override setSize(width: number, height: number): void {
    // Bound history VRAM independently of export size; preserve the frame aspect ratio.
    const scale = Math.min(1, 960 / Math.max(width, height));
    for (const target of this.targets) target.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    this.reset();
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number): void {
    // Long tab suspensions must expire old images instead of replaying stale poses.
    this.time += Math.max(0, Number.isFinite(deltaTime) ? deltaTime : 0);
    const { duration, strength, echoes } = this.settings;
    this.composite.uniforms.tDiffuse!.value = readBuffer.texture;
    for (let i = 0; i < SLOTS; i++) {
      const age = this.time - this.times[i]!;
      this.composite.uniforms[`weight${i}`]!.value = age >= 0 && age < duration
        ? strength * Math.pow(1 - age / duration, 0.7) : 0;
    }
    this.quad.material = this.composite;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);

    if (this.time - this.lastCapture >= duration / echoes) {
      // Capture the unmodified input AFTER composing, so a fresh sample isn't counted twice.
      this.copy.uniforms.tDiffuse!.value = readBuffer.texture;
      this.quad.material = this.copy;
      renderer.setRenderTarget(this.targets[this.cursor]!);
      this.quad.render(renderer);
      this.times[this.cursor] = this.time;
      this.cursor = (this.cursor + 1) % SLOTS;
      this.lastCapture = this.time;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
  }

  override dispose(): void {
    for (const target of this.targets) target.dispose();
    this.composite.dispose();
    this.copy.dispose();
    this.quad.dispose();
  }
}
