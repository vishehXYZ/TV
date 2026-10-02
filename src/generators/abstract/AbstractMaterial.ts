import * as THREE from 'three';
import vertexShader from './abstract.vert.glsl';
import fragmentShader from './abstract.frag.glsl';

export const MAX_JOINTS = 13;

export interface AbstractParams {
  /** Overall zoom of the noise field — higher packs more pattern detail into the frame. */
  scale: number;
  /** Multiplier on how strongly the field warps around joints/movement. */
  warpStrength: number;
  /** Multiplier on how fast the pattern churns/scrolls over time. */
  flowSpeed: number;
  /** Number of posterized brushstroke color bands (fewer = bolder flat patches). */
  bandCount: number;
  /** Softness of the edge between posterized bands (0 = razor, higher = soft gradient). */
  edgeSoftness: number;
}

export const DEFAULT_ABSTRACT_PARAMS: AbstractParams = {
  scale: 1.3,
  warpStrength: 1.0,
  flowSpeed: 1.0,
  bandCount: 6,
  edgeSoftness: 0.1,
};

/**
 * Fullscreen painterly domain-warped noise field, colored by palette and
 * warped toward the body's joints. Supports two reveal modes: a static
 * body-silhouette mask (Abstract "Fill"), or a continuously-updated, softly
 * decaying paint-trail texture that reveals the pattern only where you've
 * recently moved (Abstract "Grow") — a filtered texture sample rather than
 * a set of discrete splat shapes, so the reveal flows smoothly instead of
 * popping in and out.
 */
export class AbstractMaterial extends THREE.ShaderMaterial {
  constructor(palette: THREE.Color[]) {
    const paletteUniform = [0, 1, 2, 3, 4].map((i) => palette[i]?.clone() ?? new THREE.Color(0xffffff));

    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPalette: { value: paletteUniform },
        uEnergy: { value: 0 },
        uJoints: { value: Array.from({ length: MAX_JOINTS }, () => new THREE.Vector2()) },
        uJointCount: { value: 0 },
        uMask: { value: null as THREE.Texture | null },
        uMaskResolution: { value: new THREE.Vector2(1, 1) },
        uHasMask: { value: 0 },
        uMaskFeather: { value: 0.08 },
        uTrail: { value: null as THREE.Texture | null },
        uUseReveal: { value: 0 },
        uScale: { value: DEFAULT_ABSTRACT_PARAMS.scale },
        uWarpStrength: { value: DEFAULT_ABSTRACT_PARAMS.warpStrength },
        uFlowSpeed: { value: DEFAULT_ABSTRACT_PARAMS.flowSpeed },
        uBandCount: { value: DEFAULT_ABSTRACT_PARAMS.bandCount },
        uEdgeSoftness: { value: DEFAULT_ABSTRACT_PARAMS.edgeSoftness },
      },
    });
  }

  setParams(params: Partial<AbstractParams>): void {
    if (params.scale !== undefined) this.uniforms.uScale.value = params.scale;
    if (params.warpStrength !== undefined) this.uniforms.uWarpStrength.value = params.warpStrength;
    if (params.flowSpeed !== undefined) this.uniforms.uFlowSpeed.value = params.flowSpeed;
    if (params.bandCount !== undefined) this.uniforms.uBandCount.value = params.bandCount;
    if (params.edgeSoftness !== undefined) this.uniforms.uEdgeSoftness.value = params.edgeSoftness;
  }

  setTime(time: number): void {
    this.uniforms.uTime.value = time;
  }

  setAspect(aspect: number): void {
    this.uniforms.uAspect.value = aspect;
  }

  setEnergy(energy: number): void {
    this.uniforms.uEnergy.value = energy;
  }

  setPalette(colors: THREE.Color[]): void {
    const arr = this.uniforms.uPalette.value as THREE.Color[];
    for (let i = 0; i < arr.length; i++) {
      if (colors[i]) arr[i].copy(colors[i]);
    }
  }

  setJoints(joints: THREE.Vector2[]): void {
    const arr = this.uniforms.uJoints.value as THREE.Vector2[];
    for (let i = 0; i < MAX_JOINTS; i++) {
      if (i < joints.length) arr[i].copy(joints[i]!);
      else arr[i].set(0, 0);
    }
    this.uniforms.uJointCount.value = Math.min(joints.length, MAX_JOINTS);
  }

  setMask(mask: THREE.Texture | null, width: number, height: number): void {
    this.uniforms.uMask.value = mask;
    (this.uniforms.uMaskResolution.value as THREE.Vector2).set(width, height);
    this.uniforms.uHasMask.value = mask ? 1 : 0;
  }

  setUseReveal(use: boolean): void {
    this.uniforms.uUseReveal.value = use ? 1 : 0;
  }

  setTrail(trail: THREE.Texture | null): void {
    this.uniforms.uTrail.value = trail;
  }
}
