import * as THREE from 'three';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import { GenerativeBackground } from './GenerativeBackground';
import type { PoseState } from '../tracking/PoseState';
import type { SceneManager } from './SceneManager';
import { clipMediaMaterial } from './GlassMediaMask';
import { BackgroundMaterial } from '../generators/background/BackgroundMaterial';

export type BackgroundMode = 'none' | 'camera' | 'image' | 'video' | 'generative';

/**
 * Optional fullscreen background behind every visual mode: the live camera
 * feed, or a user-uploaded image/video. Opaque (not transparent) so it
 * always renders as the base layer regardless of z-ordering precision.
 * Cover-cropped to the canvas aspect and mirrored to match the stage's
 * mirrored-selfie convention used everywhere else in the app. Color-graded
 * (brightness/contrast/saturation) via a custom shader material so uploaded
 * media can be adjusted to taste rather than only playing back as shot.
 */
export class BackgroundLayer {
  readonly mesh: THREE.Mesh;
  generator: GenerativeBackground | null = null;
  private readonly crossingMesh: THREE.Mesh;
  private readonly crossingMaterial: BackgroundMaterial;
  private readonly bodyMask = new SegmentationMaskTexture();
  /** Camera foreground uses its own source UV, so mask and image have identical cover crop/mirroring. */
  setBodyIsolation(pose: PoseState, enabled: boolean): void {
    const active=enabled && this.mode==='camera';
    this.material.uniforms.uBodyOnly!.value=active?1:0;
    const mask=active&&pose.hasDetection?this.bodyMask.update(pose):null;
    this.material.uniforms.uBodyMask!.value=mask;
    this.material.uniforms.uBodyMaskReady!.value=mask?1:0;
  }
  setGenerative(): void {
    this.clearSource(); this.mode = 'generative';
    this.generator = new GenerativeBackground(); this.currentTexture = this.generator.texture;
    this.material.setMap(this.currentTexture); this.mesh.visible = true;
  }
  updateGenerative(time: number, pose: PoseState, body: number, audio: number): void {
    if (this.mode !== 'generative' || !this.generator) return;
    this.generator.update(time, this.sceneManager.aspect, pose, body, audio, this.sceneManager.renderer);
    this.sourceAspect = this.sceneManager.aspect;
    this.crossingMaterial.setMap(this.generator.frontTexture);
    this.crossingMesh.scale.set(this.sceneManager.aspect,1,1);
    this.crossingMesh.visible=this.drivesBackdrop && this.generator.settings.bodyPlacement!=='Behind body';
  }

  private sceneManager: SceneManager;
  private drivesBackdrop: boolean;
  private material: BackgroundMaterial;
  private currentTexture: THREE.Texture | null = null;
  private ownedVideoEl: HTMLVideoElement | null = null;
  private sharedVideoEl: HTMLVideoElement | null = null;
  private objectUrl: string | null = null;
  private sourceAspect = 16 / 9;
  private dimAmount = 0;
  private opacityAmount = 1;
  private playbackRate = 1;
  private trimStart = 0;
  private trimEnd = Infinity;
  get videoElement(): HTMLVideoElement | null { return this.ownedVideoEl; }
  setTrim(start: number, end: number): void {
    const v = this.ownedVideoEl;
    if (!v || !Number.isFinite(v.duration) || start < 0 || end <= start || end > v.duration) throw new Error("Choose valid Start/End times within the video duration.");
    this.trimStart = start; this.trimEnd = end; v.currentTime = start;
  }
  resetTrim(): void { this.trimStart = 0; this.trimEnd = Infinity; }
  mode: BackgroundMode = 'none';
  placement: 'Full background' | 'Inside glass' | 'Inside volumes' = 'Full background';
  solidColor: 'black' | 'white' = 'black';
  private colorListeners = new Set<(color: 'black' | 'white') => void>();
  onCanvasColor(listener: (color: 'black' | 'white') => void): void { this.colorListeners.add(listener); listener(this.solidColor); }
  setSolidColor(color: 'black' | 'white'): void { this.solidColor = color; for(const listener of this.colorListeners) listener(color); }

  constructor(sceneManager: SceneManager, drivesBackdrop = true) {
    this.drivesBackdrop = drivesBackdrop;
    this.sceneManager = sceneManager;
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new BackgroundMaterial();
    clipMediaMaterial(this.material, drivesBackdrop ? sceneManager.mediaUniforms : sceneManager.foregroundUniforms);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = drivesBackdrop ? -0.99 : -0.98;
    this.mesh.renderOrder = drivesBackdrop ? -1000 : -999;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);
    sceneManager.registerMediaLayer?.(this.mesh);
    this.crossingMaterial = new BackgroundMaterial();
    for (const key of ['uOpacity','uDim','uBrightness','uContrast','uSaturation']) this.crossingMaterial.uniforms[key]=this.material.uniforms[key]!;
    this.crossingMaterial.depthTest=false;this.crossingMaterial.depthWrite=false;
    clipMediaMaterial(this.crossingMaterial,drivesBackdrop?sceneManager.mediaUniforms:sceneManager.foregroundUniforms);
    this.crossingMesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.crossingMaterial);
    this.crossingMesh.renderOrder=10000;this.crossingMesh.visible=false;
    sceneManager.scene.add(this.crossingMesh);sceneManager.registerMediaLayer?.(this.crossingMesh);
  }

  /** Uses the same <video> element the app already streams the webcam into (no duplicate getUserMedia request). */
  setCamera(videoEl: HTMLVideoElement): void {
    this.clearSource();
    this.mode = 'camera';
    this.sharedVideoEl = videoEl;
    const texture = new THREE.VideoTexture(videoEl);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.currentTexture = texture;
    this.material.setMap(texture);
    this.mesh.visible = true;
  }

  setImage(url: string): void {
    this.clearSource();
    this.mode = 'image';
    this.objectUrl = url;
    new THREE.TextureLoader().load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      this.currentTexture = texture;
      this.sourceAspect = texture.image.width / texture.image.height;
      this.material.setMap(texture);
      this.mesh.visible = true;
      this.updateCover();
    });
  }

  setVideo(url: string): void {
    this.clearSource();
    this.mode = 'video';
    this.resetTrim();
    this.objectUrl = url;
    const video = document.createElement('video');
    video.src = url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.playbackRate = this.playbackRate;
    void video.play().catch(() => undefined);
    this.ownedVideoEl = video;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.currentTexture = texture;
    this.material.setMap(texture);
    this.mesh.visible = true;
  }

  clear(): void {
    this.clearSource();
    this.mode = 'none';
    this.mesh.visible = false;
  }

  /** The currently active background texture (camera/image/video), or null if mode is 'none' — shared with any mode (Melt, Glitch) that samples the background directly instead of drawing its own separate layer. */
  getTexture(): THREE.Texture | null {
    return this.currentTexture;
  }

  /** 0 = full brightness ("Light"), higher = darker backdrop — helps glowing/additive patterns stay visible against a bright real-world background. Separate from the brightness/contrast/saturation grading below, which is about editing the uploaded media itself. */
  setDim(amount: number): void {
    this.dimAmount = THREE.MathUtils.clamp(amount, 0, 1);
    this.material.setDim(this.dimAmount);
  }

  getDim(): number {
    return this.dimAmount;
  }

  /** 1 = fully visible, 0 = fully faded out — independent of Light/Dark backdrop dim, mainly used by Self View so you can dial in how much of yourself shows through. */
  setOpacity(amount: number): void {
    this.opacityAmount = THREE.MathUtils.clamp(amount, 0, 1);
    this.material.setOpacity(this.opacityAmount);
  }

  getOpacity(): number {
    return this.opacityAmount;
  }

  /** 1 = unchanged, <1 darker, >1 brighter. */
  setBrightness(value: number): void {
    this.material.setBrightness(value);
  }

  /** 1 = unchanged, <1 flatter, >1 punchier. */
  setContrast(value: number): void {
    this.material.setContrast(value);
  }

  /** 1 = unchanged, 0 = grayscale, >1 more vivid. */
  setSaturation(value: number): void {
    this.material.setSaturation(value);
  }

  /** Playback speed for an uploaded video background — no-op for camera/image, since you can't
   * meaningfully "speed up" a live feed or a still image. Remembered across setVideo() calls so
   * switching videos keeps whatever speed was last dialed in. */
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.ownedVideoEl) this.ownedVideoEl.playbackRate = rate;
  }

  private clearSource(): void {
    this.crossingMesh.visible=false;this.crossingMaterial.setMap(null);
    this.material.uniforms.uBodyOnly!.value=0;this.material.uniforms.uBodyMaskReady!.value=0;
    if (this.generator) this.generator.dispose();
    else this.currentTexture?.dispose();
    this.generator = null;
    this.currentTexture = null;
    this.material.setMap(null);
    if (this.ownedVideoEl) {
      this.ownedVideoEl.pause();
      this.ownedVideoEl.src = '';
      this.ownedVideoEl = null;
    }
    this.sharedVideoEl = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  update(monochrome = false, strongInk = false): void {
    if (this.drivesBackdrop) this.sceneManager.setWhiteBackdrop(this.solidColor === 'white', monochrome, strongInk);
    if (this.mode === 'none') return;
    const activeVideo = this.ownedVideoEl ?? this.sharedVideoEl;
    if (this.ownedVideoEl && (this.ownedVideoEl.currentTime >= this.trimEnd || this.ownedVideoEl.currentTime < this.trimStart)) this.ownedVideoEl.currentTime = this.trimStart;
    if (activeVideo) {
      // A VideoTexture's first GPU upload happens on first use regardless of readiness; uploading a
      // 0x0 video (no stream/frame yet) throws GL_INVALID_VALUE. Stay hidden until it actually has data.
      if (activeVideo.readyState < 2 || activeVideo.videoWidth === 0) {
        this.mesh.visible = false;
        return;
      }
      this.sourceAspect = activeVideo.videoWidth / activeVideo.videoHeight;
    }
    this.mesh.visible = true;
    this.updateCover();
  }

  private updateCover(): void {
    const canvasAspect = this.sceneManager.aspect;
    this.mesh.scale.set(canvasAspect, 1, 1);

    const texture = this.currentTexture;
    if (!texture) return;

    let repeatX = 1;
    let repeatY = 1;
    let offsetX = 0;
    let offsetY = 0;
    if (this.sourceAspect > canvasAspect) {
      repeatX = canvasAspect / this.sourceAspect;
      offsetX = (1 - repeatX) / 2;
    } else {
      repeatY = this.sourceAspect / canvasAspect;
      offsetY = (1 - repeatY) / 2;
    }

    // Mirror horizontally (negative repeat + compensating offset) to match the mirrored-selfie stage
    // convention every mode's body tracking already uses.
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    // Set on both the material (this layer's own custom shader doesn't auto-apply texture.repeat/
    // offset the way a built-in material would) AND the texture object itself — Glitch/DistortGlitch/
    // PixelMelt/GlitchLines/GlitchMono all read backgroundLayer.getTexture().repeat/.offset directly
    // to cover-crop/mirror the SAME background when they sample it themselves, and silently broke
    // (fell back to no crop/no mirror) when this stopped being set here during the color-grading work.
    const rx = this.mode === 'generative' ? repeatX : -repeatX;
    const ox = this.mode === 'generative' ? offsetX : offsetX + repeatX;
    texture.repeat.set(rx, repeatY);
    texture.offset.set(ox, offsetY);
    this.material.setRepeatOffset(rx, repeatY, ox, offsetY);
  }

  dispose(): void {
    this.clearSource();
    this.sceneManager.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.sceneManager.scene.remove(this.crossingMesh);this.crossingMesh.geometry.dispose();this.crossingMaterial.dispose();this.bodyMask.dispose();
  }
}
