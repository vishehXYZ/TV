import * as THREE from 'three';
import { ObjectLayers } from './ObjectLayers';
import { glassMediaMaskGLSL, glassMediaUniforms, sharedScopePass } from './GlassMediaMask';
import { LineWeightPass } from './LineWeightPass';
import { GlassVolumePass } from './GlassVolumePass';
import { MotionDelayPass } from './MotionDelayPass';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
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
  readonly objectLayers: ObjectLayers;
  readonly lineWeightPass: LineWeightPass;
  readonly glassVolumePass: GlassVolumePass;
  readonly motionDelayPass: MotionDelayPass;
  readonly bloomPass: UnrealBloomPass;

  private composer: EffectComposer;
  readonly mediaUniforms: Record<string, THREE.IUniform>;
  readonly effectMediaUniforms: Record<string, THREE.IUniform>;
  readonly foregroundUniforms: Record<string, THREE.IUniform>;
  private backdropPass: ShaderPass;
  private artworkScope: ShaderPass;
  private mediaScene = new THREE.Scene();
  private mediaClones: {source: THREE.Mesh; clone: THREE.Mesh}[] = [];
  private rawMedia = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  private cleanMedia = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  private cleanQuad: FullScreenQuad;
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

    this.lineWeightPass = new LineWeightPass();
    this.composer.addPass(this.lineWeightPass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.55, 0.72);
    this.composer.addPass(this.bloomPass);
    this.motionDelayPass = new MotionDelayPass();
    this.composer.addPass(this.motionDelayPass);
    this.glassVolumePass = new GlassVolumePass();
    this.objectLayers = new ObjectLayers();
    this.mediaUniforms = glassMediaUniforms(this.glassVolumePass);
    this.mediaUniforms.uObjectMask!.value = this.objectLayers.mediaMask.texture;
    this.foregroundUniforms = { ...this.mediaUniforms, uMediaInside: {value:0} };
    this.effectMediaUniforms = { ...this.mediaUniforms, uMediaInside: {value:0} };
    // Composite a white paper backdrop after glow, keeping existing additive visuals readable.
    this.backdropPass = sharedScopePass({
      uniforms: { ...this.mediaUniforms, uMediaPresent: { value: 0 }, uFullMedia: {value:0}, tDiffuse: { value: null }, uWhite: { value: 0 }, uMonochrome: { value: 0 }, uStrongInk: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: glassMediaMaskGLSL + 'uniform float uMediaPresent,uFullMedia; uniform sampler2D tDiffuse; uniform float uWhite; uniform float uMonochrome; uniform float uStrongInk; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv); vec3 ink=clamp(c.rgb-vec3(0.001518,0.001518,0.003035),0.0,1.0); float coverage=max(ink.r,max(ink.g,ink.b)); float inkCoverage=clamp(coverage*1.7,0.0,1.0); vec3 strong=mix(vec3(1.0),ink/max(coverage,0.00001)*0.3,inkCoverage); vec3 paper=mix(mix(vec3(1.0-coverage)+ink*0.65,strong,uStrongInk),vec3(1.0-coverage),uMonochrome); float paperWeight=uWhite; if(uMediaPresent>0.5){paperWeight=uFullMedia>0.5 ? 0.0 : uWhite*(glassContains(vUv)?0.0:1.0);} gl_FragColor=vec4(mix(c.rgb,paper,paperWeight),c.a);}',
    });
    this.composer.addPass(this.backdropPass);
    this.cleanQuad = new FullScreenQuad(this.backdropPass.material);
    this.artworkScope = sharedScopePass({
      uniforms: { ...this.mediaUniforms, tDiffuse:{value:null}, tCleanMedia:{value:this.cleanMedia.texture}, tEffectMask:{value:this.objectLayers.effectMask.texture}, uLegacyClip:{value:0} },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: glassMediaMaskGLSL + 'uniform sampler2D tDiffuse,tCleanMedia,tEffectMask; uniform float uLegacyClip; varying vec2 vUv; void main(){float keep=max(texture2D(tEffectMask,vUv).r,uLegacyClip>0.5&&legacyGlassContains(vUv)?1.0:0.0);gl_FragColor=mix(texture2D(tCleanMedia,vUv),texture2D(tDiffuse,vUv),step(0.5,keep));}',
    });
    this.artworkScope.enabled=false;
    this.composer.addPass(this.artworkScope);
    this.composer.addPass(this.glassVolumePass);
    this.composer.addPass(this.objectLayers);
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
    const pixels = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rawMedia.setSize(pixels.x,pixels.y);this.cleanMedia.setSize(pixels.x,pixels.y);
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

  setWhiteBackdrop(enabled: boolean, monochrome = false, strongInk = false): void { this.backdropPass.uniforms.uWhite!.value = enabled ? 1 : 0; this.backdropPass.uniforms.uMonochrome!.value = monochrome ? 1 : 0; this.backdropPass.uniforms.uStrongInk!.value = strongInk ? 1 : 0; }

  registerMediaLayer(source: THREE.Mesh): void {
    const clone=new THREE.Mesh(source.geometry,source.material);clone.matrixAutoUpdate=false;
    this.mediaClones.push({source,clone});this.mediaScene.add(clone);
  }

  setMediaScopes(backgroundInside: boolean, backgroundPresent: boolean, foregroundInside: boolean, foregroundPresent: boolean, legacyEnabled: boolean): void {
    this.mediaUniforms.uMediaInside!.value=backgroundInside?1:0;
    this.foregroundUniforms.uMediaInside!.value=foregroundInside?1:0;
    this.effectMediaUniforms.uMediaInside!.value=foregroundPresent?(foregroundInside?1:0):(backgroundInside?1:0);
    this.mediaUniforms.uGLegacyEnabled!.value=legacyEnabled?1:0;
    this.backdropPass.uniforms.uMediaPresent!.value=backgroundPresent||foregroundPresent?1:0;
    this.backdropPass.uniforms.uFullMedia!.value=(backgroundPresent&&!backgroundInside)||(foregroundPresent&&!foregroundInside)?1:0;
  }

  private captureCleanMedia(): void {
    for(const {source,clone} of this.mediaClones){source.updateMatrixWorld();clone.matrix.copy(source.matrixWorld);clone.visible=source.visible;clone.renderOrder=source.renderOrder;}
    const renderer=this.renderer;const target=renderer.getRenderTarget();const autoClear=renderer.autoClear;
    const color=renderer.getClearColor(new THREE.Color()).clone();const alpha=renderer.getClearAlpha();
    const input=this.backdropPass.uniforms.tDiffuse!.value;
    try{
      renderer.autoClear=true;renderer.setClearColor(0x05050a,1);renderer.setRenderTarget(this.rawMedia);renderer.render(this.mediaScene,this.camera);
      this.backdropPass.uniforms.tDiffuse!.value=this.rawMedia.texture;
      renderer.setRenderTarget(this.cleanMedia);this.cleanQuad.render(renderer);
    } finally {this.backdropPass.uniforms.tDiffuse!.value=input;renderer.autoClear=autoClear;renderer.setClearColor(color,alpha);renderer.setRenderTarget(target);}
  }

  render(): void {
    const legacyClip=this.glassVolumePass.enabled&&this.glassVolumePass.uniforms.uClip!.value>0.5;
    this.artworkScope.enabled=legacyClip||this.objectLayers.layers.some(layer=>layer.visible&&layer.clipEffects);
    this.artworkScope.uniforms.uLegacyClip!.value=legacyClip?1:0;
    const needMediaMask=this.mediaUniforms.uMediaInside!.value>0.5||this.foregroundUniforms.uMediaInside!.value>0.5;
    this.objectLayers.renderMasks(this.renderer,needMediaMask,this.artworkScope.enabled);
    if(this.artworkScope.enabled)this.captureCleanMedia();
    // Clipping applies to artwork only, leaving full-stage media intact.
    const clip=this.glassVolumePass.uniforms.uClip!.value;this.glassVolumePass.uniforms.uClip!.value=0;
    try{this.composer.render();}finally{this.glassVolumePass.uniforms.uClip!.value=clip;}
  }
}
