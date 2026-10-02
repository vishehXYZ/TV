import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { PoseTracker } from '../tracking/PoseTracker';
import type { AppState } from '../core/AppState';
import { DanceStarMaterial, addMotifVarietyAttributes } from '../generators/girih/DanceStarMaterial';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import { sampleMaskRaw } from '../tracking/sampleMaskRaw';
import { FlowFieldParticles } from './shared/FlowFieldParticles';

const GRID_COLS = 30;
const GRID_ROWS = 21;
const INSTANCE_COUNT = GRID_COLS * GRID_ROWS;
/** Max stage-distance for two nearby sparks to draw a crackling connecting line between them. */
const LINE_MAX_DIST = 0.3;
/** How often (seconds) the set of flickering connections/spark visibility re-rolls — a stepped clock, not a smooth fade, for an authentic electric flicker. */
const FLICKER_INTERVAL = 0.08;

function hash21(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Mode "Astrix" — a dense field of small, sharp, flickering spark motifs
 * fills the screen (body cut out as empty space, same as Luns/Code),
 * connected by a denser web of crackling lines (grid + diagonal
 * connections) between nearby sparks that flicker in and out. Sparks
 * sitting right at the hollow body's boundary glow brighter, tracing a
 * clear lit outline around the empty silhouette. Sparks near a fast-moving
 * hand or foot also ignite reliably and brightly via direct joint-velocity
 * tracking — a clear, felt reaction to your movement, not just a diffuse
 * shared pull. Connections vary in width — thin crackle threads plus
 * occasional thick dominant bolts — rendered as real triangle geometry
 * rather than 1px GL lines. Movement/sound energy also drives the ambient
 * flicker rate, brightness, and bolt thickness, so it reads even from
 * music alone with no camera.
 */
export class LightningMode {
  readonly mesh: THREE.InstancedMesh;
  readonly material: DanceStarMaterial;
  readonly lineMesh: THREE.Mesh;

  private sceneManager: SceneManager;
  private maskTexture = new SegmentationMaskTexture();
  private flow: FlowFieldParticles;
  private dummy = new THREE.Object3D();
  private lineGeometry: THREE.BufferGeometry;
  private linePositions: Float32Array;
  private lineColors: Float32Array;
  // Direct hand/foot tracking (separate from the shared FlowFieldParticles vortex math) so sparks
  // near a fast-moving hand or foot can ignite reliably and visibly — a clear, felt interaction cue
  // rather than only a diffuse shared pull.
  private static readonly IGNITE_JOINTS = [15, 16, 27, 28];
  private static readonly IGNITE_RADIUS = 0.32;
  private igniteJointPos: THREE.Vector2[] = LightningMode.IGNITE_JOINTS.map(() => new THREE.Vector2());
  private ignitePrevJointPos: THREE.Vector2[] = LightningMode.IGNITE_JOINTS.map(() => new THREE.Vector2());
  private igniteJointSpeed: number[] = LightningMode.IGNITE_JOINTS.map(() => 0);
  private hasPrevIgniteJoints = false;

  constructor(sceneManager: SceneManager, appState: AppState) {
    this.sceneManager = sceneManager;
    this.material = new DanceStarMaterial(appState.palette);
    this.material.setInvertMask(true);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const seeds = new Float32Array(INSTANCE_COUNT);
    for (let i = 0; i < INSTANCE_COUNT; i++) seeds[i] = Math.random();
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    // Sharp, spiky, varied star shapes — reads as electric sparks rather than soft orbs.
    // Richer motif pool than Luns: extra higher-order symmetries + sharper points, for
    // more intricate/complicated spark shapes as requested.
    addMotifVarietyAttributes(geometry, INSTANCE_COUNT, Math.random, {
      extraSymmetries: [16, 20, 24],
      sharpnessRange: [2.0, 6.0],
    });

    this.mesh = new THREE.InstancedMesh(geometry, this.material, INSTANCE_COUNT);
    this.mesh.position.z = -0.2;
    this.mesh.visible = false;
    sceneManager.scene.add(this.mesh);

    // 6 vertices (2 triangles) per crackling connection, instead of 2 GL_LINE
    // vertices — GL line width is capped at ~1px in most browsers regardless
    // of `linewidth`, so real thickness variety needs actual triangle quads.
    // Up to 4 possible edges per cell now (right/down/both diagonals).
    const maxLineVerts = INSTANCE_COUNT * 4 * 6;
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
    const lineMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.lineMesh = new THREE.Mesh(this.lineGeometry, lineMaterial);
    this.lineMesh.position.z = -0.18;
    this.lineMesh.visible = false;
    sceneManager.scene.add(this.lineMesh);

    this.flow = new FlowFieldParticles(sceneManager, {
      gridCols: GRID_COLS,
      gridRows: GRID_ROWS,
      // Snappier than Dance's default — electric sparks should feel jittery/immediate, not lazy.
      responsiveness: 12,
      homeSpringStrength: 0.3,
      bodyClearance: 0.22,
    });
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
    this.lineMesh.visible = visible;
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, dt: number): void {
    const aspect = this.sceneManager.aspect;
    this.material.setTime(elapsedSeconds);
    this.material.setPalette(appState.palette);
    this.material.setAspect(aspect);

    const state = poseTracker.state;
    const texture = this.maskTexture.update(state);
    this.material.setMask(texture, this.maskTexture.width, this.maskTexture.height);

    this.flow.updateJoints(poseTracker, Math.min(dt, 0.1));

    // Direct hand/foot velocity tracking, independent of the shared flow-field math — this is what
    // lets sparks near your moving hands/feet ignite clearly and reliably.
    const clampedDt = Math.min(dt, 0.1);
    if (state.hasDetection) {
      for (let j = 0; j < LightningMode.IGNITE_JOINTS.length; j++) {
        const lm = state.landmarks[LightningMode.IGNITE_JOINTS[j]!];
        if (!lm) continue;
        this.sceneManager.imageToStage(lm.x, lm.y, this.igniteJointPos[j]!);
      }
      if (this.hasPrevIgniteJoints && clampedDt > 0.0001) {
        for (let j = 0; j < LightningMode.IGNITE_JOINTS.length; j++) {
          const dx = this.igniteJointPos[j]!.x - this.ignitePrevJointPos[j]!.x;
          const dy = this.igniteJointPos[j]!.y - this.ignitePrevJointPos[j]!.y;
          this.igniteJointSpeed[j] = Math.sqrt(dx * dx + dy * dy) / clampedDt;
        }
      }
      for (let j = 0; j < LightningMode.IGNITE_JOINTS.length; j++) this.ignitePrevJointPos[j]!.copy(this.igniteJointPos[j]!);
      this.hasPrevIgniteJoints = true;
    } else {
      this.igniteJointSpeed.fill(0);
    }

    // Movement AND sound energy both boost this — works purely from music with no camera enabled too.
    const energyBoost = Math.min(state.energy * 1.4, 0.6);
    this.flow.step(dt, (p, out) => {
      // A sharp, jittery per-particle vibration (not smooth drift) — electric rather than organic.
      const tick = Math.floor(elapsedSeconds * 9 + p.seed * 47);
      out.x += (hash21(tick, p.seed) - 0.5) * 0.06 * (0.5 + energyBoost);
      out.y += (hash21(tick + 91, p.seed) - 0.5) * 0.06 * (0.5 + energyBoost);
    });

    const tick = Math.floor(elapsedSeconds / FLICKER_INTERVAL);
    // ~630 spark instances plus a diagonal-connected line web, both additively blended under the bloom
    // pass — the old baseline (0.55, ~45% of sparks lit even at total rest) blew the whole screen out to
    // solid white regardless of energy (confirmed via direct pixel testing: ~91% white pixels at rest,
    // 100% at high energy). Raised so rest reads as a sparse scatter of sparks and only climbs toward a
    // denser (but still not fully blown-out) web as real energy comes in.
    const flickerThreshold = 0.84 - Math.min(energyBoost, 0.6) * 0.4;

    let i = 0;
    const mask = state.segmentationMask;
    for (const p of this.flow.particles) {
      // Real proximity-based ignition: sparks near a fast-moving hand/foot light up reliably,
      // independent of the ambient flicker roll — the clear "sparks react to you" cue.
      let ignite = 0;
      for (let j = 0; j < LightningMode.IGNITE_JOINTS.length; j++) {
        const jp = this.igniteJointPos[j]!;
        const speed = this.igniteJointSpeed[j]!;
        if (speed < 0.6) continue;
        const dx = p.x - jp.x;
        const dy = p.y - jp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > LightningMode.IGNITE_RADIUS) continue;
        const proximity = 1 - dist / LightningMode.IGNITE_RADIUS;
        ignite = Math.max(ignite, proximity * Math.min(speed * 0.4, 1.4));
      }

      // Edge-glow: sparks sitting right at the hollow body's boundary light up brighter/bigger,
      // tracing a clear lit outline around the empty silhouette rather than it just fading
      // ambiguously into the background field.
      let edgeGlow = 0;
      if (mask) {
        const maskVal = sampleMaskRaw(p.x, p.y, aspect, mask);
        // Body edge sits around maskVal ~0.5; peak glow right at the boundary, fading a short distance either side.
        edgeGlow = Math.max(0, 1 - Math.abs(maskVal - 0.5) * 5);
      }

      const flickerOn = ignite > 0.15 || edgeGlow > 0.2 || hash21(tick, p.seed * 133.7) > flickerThreshold;
      const scale = flickerOn ? (0.02 + p.seed * 0.026 + energyBoost * 0.01) * (1 + ignite * 1.8) * (1 + edgeGlow * 1.1) : 0;
      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.rotation.z = hash21(tick, p.seed * 7.1) * 6.283;
      this.dummy.scale.set(scale, scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      i++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    this.rebuildLines(appState, tick, flickerThreshold, energyBoost);
  }

  /** Crackling connections between nearby sparks — only a flickering random subset re-rolled each tick, not a static persistent web. Each connection gets its own width (thin crackle threads vs. occasional thick dominant bolts), for real size/thickness variety rather than a uniform 1px line. */
  private rebuildLines(appState: AppState, tick: number, flickerThreshold: number, energyBoost: number): void {
    let vIdx = 0;
    const palette = appState.palette;
    const tmpColor = new THREE.Color();
    const maxVerts = this.linePositions.length / 3;
    const particles = this.flow.particles;

    const pushEdge = (a: (typeof particles)[number], b: (typeof particles)[number]): void => {
      if (vIdx + 6 > maxVerts) return;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > LINE_MAX_DIST * LINE_MAX_DIST) return;
      // Independent flicker roll per potential edge, not tied to endpoint spark visibility — crackles
      // distinctly. Much rarer than sparks (+0.3, not +0.08): up to ~2500 possible edges (4 per cell
      // incl. diagonals), each additively-blended and pushed into HDR — near the old offset this alone
      // was enough to blow the whole screen to solid white regardless of energy.
      if (hash21(tick, a.seed * 19.3 + b.seed * 71.1) < flickerThreshold + 0.3) return;

      // Per-edge width: mostly thin crackle threads, with an occasional
      // dominant thick bolt (re-rolled every flicker tick) for real variety.
      const varietyHash = hash21(a.seed * 53.7 + tick * 0.001, b.seed * 91.3);
      let halfWidth = THREE.MathUtils.lerp(0.0018, 0.007, varietyHash);
      const isBoltHighlight = hash21(a.seed * 17.9 + tick * 0.013, b.seed * 29.3) > 0.88;
      if (isBoltHighlight) halfWidth *= 3.2;
      halfWidth *= 1 + energyBoost * 0.5;

      const dist = Math.sqrt(distSq) + 0.0001;
      const nx = (-dy / dist) * halfWidth;
      const ny = (dx / dist) * halfWidth;

      // Was lerping toward (1.5,1.5,1.6) — colors above 1.0 guarantee a hard bloom trigger on every
      // lit segment, which combined with hundreds of overlapping additive segments is what blew the
      // whole screen to white. Kept a bright "white-hot" highlight without pushing so far past 1.0.
      tmpColor.copy(palette[3]!).lerp(new THREE.Color(1.1, 1.1, 1.15), isBoltHighlight ? 0.85 : 0.6);

      const ax0 = a.x + nx;
      const ay0 = a.y + ny;
      const ax1 = a.x - nx;
      const ay1 = a.y - ny;
      const bx0 = b.x + nx;
      const by0 = b.y + ny;
      const bx1 = b.x - nx;
      const by1 = b.y - ny;

      const pushVert = (x: number, y: number): void => {
        this.linePositions[vIdx * 3] = x;
        this.linePositions[vIdx * 3 + 1] = y;
        this.linePositions[vIdx * 3 + 2] = 0;
        this.lineColors[vIdx * 3] = tmpColor.r;
        this.lineColors[vIdx * 3 + 1] = tmpColor.g;
        this.lineColors[vIdx * 3 + 2] = tmpColor.b;
        vIdx++;
      };

      // Two triangles forming the quad strip between A and B.
      pushVert(ax0, ay0);
      pushVert(ax1, ay1);
      pushVert(bx1, by1);
      pushVert(ax0, ay0);
      pushVert(bx1, by1);
      pushVert(bx0, by0);
    };

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col;
        const p = particles[idx]!;
        if (col < GRID_COLS - 1) pushEdge(p, particles[idx + 1]!);
        if (row < GRID_ROWS - 1) pushEdge(p, particles[idx + GRID_COLS]!);
        // Diagonal connections too — a denser, more intricate crackling web rather than a plain grid mesh.
        if (col < GRID_COLS - 1 && row < GRID_ROWS - 1) pushEdge(p, particles[idx + GRID_COLS + 1]!);
        if (col > 0 && row < GRID_ROWS - 1) pushEdge(p, particles[idx + GRID_COLS - 1]!);
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
    this.maskTexture.dispose();
  }
}
