import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { CodeGlyphMaterial } from '../generators/code/CodeGlyphMaterial';
import { createGlyphAtlas, type GlyphAtlas, type GlyphSet } from '../generators/code/GlyphAtlas';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import { sampleMaskRaw } from '../tracking/sampleMaskRaw';

const FLOW_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const GRID_COLS = 40;
const GRID_ROWS = 26;
const INSTANCE_COUNT = GRID_COLS * GRID_ROWS;
const BODY_CLEARANCE = 0.22;
const RESPONSIVENESS = 9;
/** Max stage-distance for two grid-adjacent glyphs to still draw a connecting circuit line. */
const LINE_MAX_DIST = 0.35;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeXNorm: number;
  homeYNorm: number;
  rotSpeed: number;
  seed: number;
  scale: number;
}

/** "Outside" swirls the same reactive body-cutout field Dance uses (body cut out, glyphs flow
 * around it). "Inside" instead fills the body silhouette itself with glyphs, sitting near their home
 * grid positions rather than being pushed around by movement — the same "dense static fill clipped to
 * you" idea Flurix uses for its girih tessellation, just with code/script glyphs instead of stars. */
export type CodeLayer = 'outside' | 'inside';

/**
 * Mode "Code" (glyphSet='code', the default) / "Script" (glyphSet='script'), each with an
 * "Outside"/"Inside" layer style — flickering digits/code symbols (Code) or Arabic/Farsi letterforms
 * (Script), with connecting circuit lines. Same class powers all four menu entries — only the baked
 * glyph atlas and layer style differ.
 */
export class CodeMode {
  readonly mesh: THREE.InstancedMesh;
  readonly material: CodeGlyphMaterial;
  readonly lineMesh: THREE.LineSegments;

  private sceneManager: SceneManager;
  private atlas: GlyphAtlas;
  private glyphSet: GlyphSet;
  /** Code's digit/symbol set never changes at runtime — only Script's language does. */
  private readonly respondsToLanguage: boolean;
  private layer: CodeLayer;
  private maskTexture = new SegmentationMaskTexture();
  private particles: Particle[] = [];
  private dummy = new THREE.Object3D();
  private glyphIndices: Float32Array;
  private jointPos: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private prevJointPos: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private jointVel: THREE.Vector2[] = FLOW_JOINTS.map(() => new THREE.Vector2());
  private hasPrevJoints = false;
  private lineGeometry: THREE.BufferGeometry;
  private linePositions: Float32Array;
  private lineColors: Float32Array;

  constructor(sceneManager: SceneManager, appState: AppState, glyphSet: GlyphSet = 'code', layer: CodeLayer = 'outside') {
    this.sceneManager = sceneManager;
    this.atlas = createGlyphAtlas(glyphSet);
    this.glyphSet = glyphSet;
    this.respondsToLanguage = glyphSet !== 'code';
    this.layer = layer;
    this.material = new CodeGlyphMaterial(appState.palette, this.atlas);
    this.material.setInvertMask(layer === 'outside');

    const geometry = new THREE.PlaneGeometry(2, 2);
    const seeds = new Float32Array(INSTANCE_COUNT);
    this.glyphIndices = new Float32Array(INSTANCE_COUNT);
    for (let i = 0; i < INSTANCE_COUNT; i++) {
      seeds[i] = Math.random();
      this.glyphIndices[i] = Math.floor(Math.random() * this.atlas.count);
    }
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.setAttribute('aGlyphIndex', new THREE.InstancedBufferAttribute(this.glyphIndices, 1).setUsage(THREE.DynamicDrawUsage));

    this.mesh = new THREE.InstancedMesh(geometry, this.material, INSTANCE_COUNT);
    this.mesh.position.z = -0.2;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);

    const maxLineVerts = INSTANCE_COUNT * 2 * 2;
    this.linePositions = new Float32Array(maxLineVerts * 3);
    this.lineColors = new Float32Array(maxLineVerts * 3);
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.linePositions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.lineGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.lineColors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    this.lineGeometry.setDrawRange(0, 0);
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lineMesh = new THREE.LineSegments(this.lineGeometry, lineMaterial);
    this.lineMesh.position.z = -0.25;
    this.lineMesh.visible = false;
    sceneManager.scene.add(this.lineMesh);

    const cellW = 2 / GRID_COLS;
    const cellH = 2 / GRID_ROWS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cx = -1 + cellW * (col + 0.5);
        const cy = -1 + cellH * (row + 0.5);
        const homeXNorm = cx + (Math.random() - 0.5) * cellW * 0.8;
        const homeYNorm = cy + (Math.random() - 0.5) * cellH * 0.8;
        this.particles.push({
          x: homeXNorm * sceneManager.aspect,
          y: homeYNorm,
          vx: 0,
          vy: 0,
          homeXNorm,
          homeYNorm,
          rotSpeed: (Math.random() - 0.5) * 0.6,
          seed: Math.random(),
          // Weighted toward small so a handful of larger glyphs stand out rather than everything being uniform.
          scale: 0.022 + Math.pow(Math.random(), 2) * 0.075,
        });
      }
    }
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
    this.lineMesh.visible = visible;
  }

  /** Rebakes the glyph atlas in place (e.g. switching Script's language) without rebuilding the mesh. */
  private setGlyphSet(set: GlyphSet): void {
    if (set === this.glyphSet) return;
    this.atlas.texture.dispose();
    this.atlas = createGlyphAtlas(set);
    this.glyphSet = set;
    this.material.setAtlas(this.atlas);
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, dt: number): void {
    const aspect = this.sceneManager.aspect;
    this.material.setTime(elapsedSeconds);
    this.material.setPalette(appState.palette);
    this.material.setAspect(aspect);

    if (this.respondsToLanguage) {
      this.setGlyphSet(appState.scriptLanguage);
      this.material.set3D(appState.script3D);
      // Additive blending (the default, used for the glowing-spark look elsewhere) sums overlapping
      // glyphs toward white regardless of hue, and bloom smears that into a pastel haze — the exact
      // opposite of "bold and colorful." Normal blending lets each glyph read as an opaque, saturated
      // shape instead, which is what the puffy/glass 3D style actually needs.
      this.material.blending = appState.script3D ? THREE.NormalBlending : THREE.AdditiveBlending;
    }

    const state = poseTracker.state;
    const texture = this.maskTexture.update(state);
    this.material.setMask(texture, this.maskTexture.width, this.maskTexture.height);

    const clampedDt = Math.min(dt, 0.1);

    if (state.hasDetection) {
      for (let i = 0; i < FLOW_JOINTS.length; i++) {
        const lm = state.landmarks[FLOW_JOINTS[i]!];
        if (!lm) continue;
        this.sceneManager.imageToStage(lm.x, lm.y, this.jointPos[i]!);
      }
      if (this.hasPrevJoints && clampedDt > 0.0001) {
        for (let i = 0; i < FLOW_JOINTS.length; i++) {
          this.jointVel[i]!.set(
            (this.jointPos[i]!.x - this.prevJointPos[i]!.x) / clampedDt,
            (this.jointPos[i]!.y - this.prevJointPos[i]!.y) / clampedDt,
          );
        }
      }
      for (let i = 0; i < FLOW_JOINTS.length; i++) this.prevJointPos[i]!.copy(this.jointPos[i]!);
      this.hasPrevJoints = true;
    }

    const blend = 1 - Math.exp(-RESPONSIVENESS * clampedDt);

    for (let idx = 0; idx < this.particles.length; idx++) {
      const p = this.particles[idx]!;
      const homeX = p.homeXNorm * aspect;
      const homeY = p.homeYNorm;

      let targetVx = 0;
      let targetVy = 0;
      let scalePulse = 1;

      if (this.layer === 'outside') {
        if (state.hasDetection) {
          for (let j = 0; j < FLOW_JOINTS.length; j++) {
            const jp = this.jointPos[j]!;
            const jv = this.jointVel[j]!;
            const dx = p.x - jp.x;
            const dy = p.y - jp.y;
            const distSq = dx * dx + dy * dy;
            const falloff = 1 / (distSq + 0.02);

            targetVx += (jv.x * 0.4 - jv.y * 0.6) * falloff * 0.08;
            targetVy += (jv.y * 0.4 + jv.x * 0.6) * falloff * 0.08;

            if (distSq < BODY_CLEARANCE * BODY_CLEARANCE) {
              const dist = Math.sqrt(distSq) + 0.0001;
              const push = (BODY_CLEARANCE - dist) * 3.5;
              targetVx += (dx / dist) * push;
              targetVy += (dy / dist) * push;
            }
          }
        } else {
          // No body (tracking paused, sound-only performance) — a slow, soft per-particle swirl driven
          // entirely by movement-energy (which already includes the audio level/kick), so the glyph
          // field keeps breathing and swaying with the music instead of freezing at rest.
          const ambientAmp = Math.min(state.energy * 1.8, 1.3);
          if (ambientAmp > 0.002) {
            const swirl = elapsedSeconds * 0.6 + p.seed * 6.283;
            targetVx += Math.cos(swirl + p.homeYNorm * 1.3) * ambientAmp * 0.6;
            targetVy += Math.sin(swirl * 1.15 + p.homeXNorm * 1.3) * ambientAmp * 0.6;
          }
        }
      } else {
        // "Inside" — deliberately NOT pushed around by the joint-vortex/body-clearance forces above:
        // those exist to keep particles OUT of the body, which is the opposite of what a dense fill
        // wants. Instead it's a dense, essentially-static grid (like Flurix's girih tessellation) with
        // just a small ambient jitter plus an energy-driven scale pulse for life, since the mask
        // (uInvertMask=false) alone decides which glyphs are visible — no drift needed for that.
        const jitterAmp = Math.min(0.03 + state.energy * 0.5, 0.18);
        const jitter = elapsedSeconds * 0.7 + p.seed * 6.283;
        targetVx += Math.cos(jitter) * jitterAmp;
        targetVy += Math.sin(jitter * 1.3) * jitterAmp;
        scalePulse = 0.85 + 0.15 * Math.sin(elapsedSeconds * 1.6 + p.seed * 6.283) + Math.min(state.energy * 0.9, 0.6);
      }

      targetVx += (homeX - p.x) * 0.3;
      targetVy += (homeY - p.y) * 0.3;

      p.vx += (targetVx - p.vx) * blend;
      p.vy += (targetVy - p.vy) * blend;
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;

      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.rotation.z = elapsedSeconds * p.rotSpeed;
      this.dummy.scale.setScalar(p.scale * scalePulse);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(idx, this.dummy.matrix);

      // Occasional flicker to a new glyph — deterministic function of time+seed, no per-particle timer state needed.
      const flickerSlot = Math.floor(elapsedSeconds * 1.2 + p.seed * 47);
      this.glyphIndices[idx] = flickerSlot % this.atlas.count;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    (this.mesh.geometry.attributes.aGlyphIndex as THREE.BufferAttribute).needsUpdate = true;

    this.rebuildLines(appState, state.segmentationMask, aspect);
  }

  private rebuildLines(
    appState: AppState,
    mask: { data: Float32Array; width: number; height: number } | null,
    aspect: number,
  ): void {
    let vIdx = 0;
    const palette = appState.palette;
    const tmpColor = new THREE.Color();
    const maxVerts = this.linePositions.length / 3;

    const pushEdge = (a: Particle, b: Particle): void => {
      if (vIdx + 2 > maxVerts) return;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy > LINE_MAX_DIST * LINE_MAX_DIST) return;
      if (mask) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const inBody = sampleMaskRaw(midX, midY, aspect, mask) > 0.5;
        // "Outside" draws circuits only where there's no body (matching the glyphs themselves);
        // "Inside" draws them only where there IS a body, so the connecting lines stay consistent
        // with wherever the glyphs are actually visible.
        if (this.layer === 'outside' ? inBody : !inBody) return;
      }
      tmpColor.copy(palette[1]!).lerp(palette[3]!, a.seed);
      this.linePositions[vIdx * 3] = a.x;
      this.linePositions[vIdx * 3 + 1] = a.y;
      this.linePositions[vIdx * 3 + 2] = 0;
      this.lineColors[vIdx * 3] = tmpColor.r;
      this.lineColors[vIdx * 3 + 1] = tmpColor.g;
      this.lineColors[vIdx * 3 + 2] = tmpColor.b;
      vIdx++;
      this.linePositions[vIdx * 3] = b.x;
      this.linePositions[vIdx * 3 + 1] = b.y;
      this.linePositions[vIdx * 3 + 2] = 0;
      this.lineColors[vIdx * 3] = tmpColor.r;
      this.lineColors[vIdx * 3 + 1] = tmpColor.g;
      this.lineColors[vIdx * 3 + 2] = tmpColor.b;
      vIdx++;
    };

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const p = this.particles[idx]!;
        if (col < GRID_COLS - 1) pushEdge(p, this.particles[idx + 1]!);
        if (row < GRID_ROWS - 1) pushEdge(p, this.particles[idx + GRID_COLS]!);
      }
    }

    this.lineGeometry.setDrawRange(0, vIdx);
    (this.lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.lineGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.sceneManager.scene.remove(this.mesh);
    this.sceneManager.scene.remove(this.lineMesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.lineGeometry.dispose();
    (this.lineMesh.material as THREE.Material).dispose();
    this.atlas.texture.dispose();
    this.maskTexture.dispose();
  }
}
