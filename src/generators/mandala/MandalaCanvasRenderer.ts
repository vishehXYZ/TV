import * as THREE from 'three';
import type { PoseTracker } from '../../tracking/PoseTracker';
import type { AppState } from '../../core/AppState';

/** Wrists, elbows, ankles, nose — same "effector" set Traxa uses for its trail-kaleidoscope. */
const EFFECTORS = [15, 16, 13, 14, 27, 28, 0];
const HIST_LEN = 44;
const FOLD = 8;

interface HistPoint {
  x: number;
  y: number;
  s: number;
}

interface AudioBands {
  kick: number;
  mid: number;
  treble: number;
}

/**
 * Faithful port of Traxa's "Mandala" renderer: each tracked effector's recent motion trail is
 * mirrored left/right about the body's hip-center, then that mirrored trail is drawn FOLD times
 * around the screen center at evenly spaced rotation angles — a true kaleidoscope of your own
 * movement, not a static procedural shape. A persistent canvas is faded (not cleared) each frame
 * via alpha erase, giving the soft, glowing, long-exposure light-painting look. With no real body
 * present, real multi-band audio reactivity takes over instead of a fabricated body: a bass "kick"
 * punches the whole kaleidoscope outward in a radial pulse, mid frequencies drive rotation speed,
 * and treble drives sparkle/brightness — a genuine media-player-style visualizer, and a handful of
 * virtual points orbit gently (amplitude driven by the kick) so there's motion to kaleidoscope.
 */
export class MandalaCanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;

  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private hist: Record<number, HistPoint[]> = {};
  private prevPos: Record<number, { x: number; y: number }> = {};
  private vel: Record<number, number> = {};
  private virtualSeed = Math.random() * 1000;

  constructor(aspect: number) {
    this.height = 720;
    this.width = Math.max(360, Math.round(this.height * aspect));
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d')!;
    for (const e of EFFECTORS) this.hist[e] = [];
    this.texture = new THREE.CanvasTexture(this.canvas);
  }

  private fadeTrail(alpha: number): void {
    const ctx = this.ctx;
    // Erase alpha instead of painting opaque black — keeps the layer genuinely transparent where
    // there's no art, so whatever background/video is already in the scene shows through underneath.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private pushHistory(effector: number, x: number, y: number): void {
    const prev = this.prevPos[effector];
    const speed = prev ? Math.hypot(x - prev.x, y - prev.y) : 0;
    this.vel[effector] = (this.vel[effector] ?? 0) * 0.7 + speed * 0.3;
    this.prevPos[effector] = { x, y };
    const h = this.hist[effector]!;
    h.push({ x, y, s: this.vel[effector]! });
    if (h.length > HIST_LEN) h.shift();
  }

  update(poseTracker: PoseTracker, appState: AppState, elapsedSeconds: number, energy: number, audio: AudioBands): void {
    const state = poseTracker.state;
    const W = this.width;
    const H = this.height;

    let bodyCx = W / 2;
    let bodyCy = H / 2;

    if (state.hasDetection) {
      const lh = state.landmarks[23];
      const rh = state.landmarks[24];
      if (lh && rh) {
        bodyCx = (1 - (lh.x + rh.x) / 2) * W;
        bodyCy = ((lh.y + rh.y) / 2) * H;
      }
      for (const e of EFFECTORS) {
        const lm = state.landmarks[e];
        if (!lm) continue;
        this.pushHistory(e, (1 - lm.x) * W, lm.y * H);
      }
    } else {
      // No real body — a few virtual points orbit gently, amplitude punching outward on the bass
      // kick specifically, so the kaleidoscope visibly pops on the beat rather than just following
      // a flat energy level. Base amp + energy term both raised — the old values (0.09 base, 0.08
      // energy weight) left the kaleidoscope reading as almost flat/invisible in testing.
      const amp = 0.16 + Math.min(audio.kick, 1.2) * 0.35 + Math.min(energy, 1) * 0.22;
      for (let i = 0; i < EFFECTORS.length; i++) {
        const e = EFFECTORS[i]!;
        const phase = elapsedSeconds * (0.3 + i * 0.06 + audio.mid * 0.25) + i * 1.7 + this.virtualSeed;
        const nx = 0.5 + Math.cos(phase) * amp * (0.65 + 0.35 * Math.sin(phase * 0.6 + i));
        const ny = 0.5 + Math.sin(phase * 1.25) * amp;
        this.pushHistory(e, nx * W, ny * H);
      }
    }

    // Fade rate breathes slightly with energy — busier/brighter trails during louder movement/music.
    this.fadeTrail(0.04 + Math.min(energy, 1) * 0.015);

    const ctx = this.ctx;
    const cx = W / 2;
    const cy = H / 2;
    // Mid frequencies drive rotation speed — the kaleidoscope visibly spins up with the melody/movement.
    const spin = elapsedSeconds * (0.05 + Math.min(audio.mid, 1.2) * 0.09 + Math.min(energy, 1) * 0.03);
    // A brief radial pulse-pop on the bass kick — the core of what makes it read as "dancing" to the beat.
    const kickPulse = 1 + Math.min(audio.kick, 1.4) * 0.22;
    const palette = appState.palette;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    EFFECTORS.forEach((e, n) => {
      const h = this.hist[e]!;
      if (h.length < 3) return;
      for (let f = 0; f < FOLD; f++) {
        const ang = spin + (f * Math.PI * 2) / FOLD;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        for (const mirror of [1, -1]) {
          const sp = h[h.length - 1]!.s;
          const color = palette[n % palette.length]!;
          // Treble adds sparkle/brightness on top of the existing speed-based brighten.
          const brighten = Math.min(sp * 0.05 + audio.treble * 0.35, 0.7);
          const r = Math.round((color.r + (1 - color.r) * brighten) * 255);
          const g = Math.round((color.g + (1 - color.g) * brighten) * 255);
          const b = Math.round((color.b + (1 - color.b) * brighten) * 255);
          // Base alpha/width raised — the old values read as almost invisible in testing, especially
          // for the no-body/virtual-point case where trail speed `sp` stays fairly low and modest.
          const alpha = 0.11 + Math.min(0.2, sp * 0.014) + Math.min(audio.treble * 0.06, 0.08);
          const lineWidth = Math.min(6, 1.8 + sp * 0.1 + audio.kick * 0.9);

          // Root spoke from the exact screen center out to the trail's oldest point — every effector's
          // trail sits some distance out from the body center, so without this the fold/mirror symmetry
          // leaves a bare hole in the middle instead of a filled core.
          const rx0 = (h[0]!.x - bodyCx) * mirror * kickPulse;
          const ry0 = (h[0]!.y - bodyCy) * kickPulse;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + rx0 * cs - ry0 * sn, cy + rx0 * sn + ry0 * cs);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.6})`;
          ctx.lineWidth = lineWidth * 0.7;
          ctx.stroke();

          ctx.beginPath();
          for (let i = 1; i < h.length; i++) {
            const rx = (h[i]!.x - bodyCx) * mirror * kickPulse;
            const ry = (h[i]!.y - bodyCy) * kickPulse;
            const X = cx + rx * cs - ry * sn;
            const Y = cy + rx * sn + ry * cs;
            if (i === 1) ctx.moveTo(X, Y);
            else ctx.lineTo(X, Y);
          }
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
      }
    });

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
