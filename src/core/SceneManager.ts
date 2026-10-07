import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Owns the Three.js scene/camera/renderer/postfx pipeline and resize handling.
 * Uses an orthographic "stage space" camera so landmark coordinates (normalized
 * 0..1 image space) map onto a stable 2D-ish plane regardless of canvas
 * aspect ratio. Renders through a bloom composer so bright linework glows —
 * essential for the gold/jewel-tone Islamic ornament look.
 */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly bloomPass: UnrealBloomPass;

  private composer: EffectComposer;
  private backdropPass: ShaderPass;
  private viewHalfHeight = 1;
  /** When set, the live view is letterboxed to this exact aspect ratio (centered within the
   * viewport) instead of filling it naturally — see setFormat(). */
  private formatOverride: { width: number; height: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x05050a, 1);

    const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
    });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.55, 0.72);
    this.composer.addPass(this.bloomPass);
    // Composite a white paper backdrop after glow, keeping existing additive visuals readable.
    this.backdropPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uWhite: { value: 0 }, uMonochrome: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float uWhite; uniform float uMonochrome; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv); vec3 ink=clamp(c.rgb-vec3(0.001518,0.001518,0.003035),0.0,1.0); float coverage=max(ink.r,max(ink.g,ink.b)); vec3 paper=mix(vec3(1.0-coverage)+ink*0.65,vec3(1.0-coverage),uMonochrome); gl_FragColor=vec4(mix(c.rgb,paper,uWhite),c.a);}',
    });
    this.composer.addPass(this.backdropPass);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  get aspect(): number {
    return this.camera.right;
  }

  /** Converts normalized MediaPipe image-space (0..1, y-down) to stage space, mirrored horizontally. */
  imageToStage(x: number, y: number, out: THREE.Vector2): THREE.Vector2 {
    const aspect = this.camera.right;
    const mirroredX = 1 - x;
    out.x = (mirroredX - 0.5) * 2 * aspect;
    out.y = -(y - 0.5) * 2 * this.viewHalfHeight;
    return out;
  }

  /** Locks the live view's on-screen shape to a specific aspect ratio (e.g. a recording format —
   * Horizontal/Vertical/Square), letterboxed and centered within the viewport, so what's actually
   * previewed on screen matches what gets recorded instead of a landscape-shaped preview getting
   * silently squashed into a portrait or square file. Persists until a different format is set. */
  setFormat(width: number, height: number): void {
    this.formatOverride = { width, height };
    this.applyLayout();
  }

  private applyLayout(): void {
    const canvas = this.renderer.domElement;
    let cssWidth: number;
    let cssHeight: number;

    if (this.formatOverride) {
      const { width: targetWidth, height: targetHeight } = this.formatOverride;
      const aspect = targetWidth / targetHeight;
      const parent = canvas.parentElement;
      const viewportWidth = parent?.clientWidth || window.innerWidth;
      const viewportHeight = parent?.clientHeight || window.innerHeight;
      cssWidth = viewportWidth;
      cssHeight = viewportWidth / aspect;
      if (cssHeight > viewportHeight) {
        cssHeight = viewportHeight;
        cssWidth = viewportHeight * aspect;
      }
      cssWidth = Math.round(cssWidth);
      cssHeight = Math.round(cssHeight);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.style.top = '50%';
      canvas.style.left = '50%';
      canvas.style.right = 'auto';
      canvas.style.bottom = 'auto';
      canvas.style.transform = 'translate(-50%, -50%)';
    } else {
      canvas.style.width = '';
      canvas.style.height = '';
      canvas.style.top = '';
      canvas.style.left = '';
      canvas.style.right = '';
      canvas.style.bottom = '';
      canvas.style.transform = '';
      cssWidth = canvas.clientWidth || window.innerWidth;
      cssHeight = canvas.clientHeight || window.innerHeight;
    }

    this.setSize(cssWidth, cssHeight);
  }

  private resize(): void {
    this.applyLayout();
  }

  private setSize(width: number, height: number): void {
    const aspect = width / height;

    this.viewHalfHeight = 1;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  /** Temporarily renders at a higher pixel resolution (same aspect) for hi-res still export. */
  resizeForExport(width: number, height: number): void {
    this.renderer.setPixelRatio(1);
    this.setSize(width, height);
  }

  /** Restores normal on-screen resolution after a hi-res export. */
  restoreDisplaySize(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize();
  }

  setWhiteBackdrop(enabled: boolean, monochrome = false): void { this.backdropPass.uniforms.uWhite!.value = enabled ? 1 : 0; this.backdropPass.uniforms.uMonochrome!.value = monochrome ? 1 : 0; }

  render(): void {
    this.composer.render();
  }
}
