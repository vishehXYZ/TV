import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';
import type { AppState } from '../core/AppState';
import type { PoseTracker } from '../tracking/PoseTracker';

/** A bounded canvas texture: moving ink, digits, sliced bands and geometric interruptions. */
export class ChaosMode {
  private canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private mesh: THREE.Mesh;
  private lastFrame = -Infinity;
  private scene: SceneManager;
  private style: number;
  constructor(scene: SceneManager, style: number) {
    this.scene = scene; this.style = style;
    this.canvas.width = 1280; this.canvas.height = 720;
    this.context = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.position.z = -0.3; this.mesh.visible = false;
    scene.scene.add(this.mesh);
  }
  setVisible(visible: boolean): void { this.mesh.visible = visible; }
  update(tracker: PoseTracker, state: AppState, time: number): void {
    this.mesh.scale.set(this.scene.aspect, 1, 1);
    if (time - this.lastFrame < 1 / 24) return;
    this.lastFrame = time;
    const c = this.context, w = this.canvas.width, h = this.canvas.height;
    const energy = Math.min(1, Math.max(0, tracker.state.energy));
    const t = time * state.chaos.speed;
    const tick = Math.floor(t * (8 + energy * 18));
    const rand = (n: number) => { const x = Math.sin(n * 127.1 + tick * 31.7) * 43758.5453; return x - Math.floor(x); };
    const colors = state.chaos.usePalette ? state.palette.map(color => `#${color.getHexString()}`) : ['#ff236b', '#00d5df', '#feae24', '#8c51ff', '#48ed88'];
    c.clearRect(0, 0, w, h);
    // Deterministic paths persist between cuts; body/audio energy bends and accelerates them.
    if (this.style !== 1) {
      for (let i = 0; i < Math.round(30 * state.chaos.density); i++) {
        c.strokeStyle = colors[i % colors.length]!;
        c.lineWidth = 0.8 + (i % 5) * 0.65;
        c.globalAlpha = 0.65 + (i % 3) * 0.1;
        c.beginPath();
        for (let j = 0; j < 65; j++) {
          const a = j * 0.13 + t * (0.15 + (i % 4) * 0.06);
          const x = w * (0.5 + 0.42 * Math.sin(a * (1 + i % 3) + i * 2.1)) + Math.sin(a * 9 + i) * (12 + energy * 35);
          const y = h * (0.5 + 0.43 * Math.cos(a * 1.7 + i * 0.9)) + Math.sin(a * 13) * (10 + energy * 30);
          if (j === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      }
    }
    if (this.style !== 0) {
      c.textBaseline = 'middle';
      for (let i = 0; i < Math.round(280 * state.chaos.density); i++) {
        const x = ((i * 137.3 + t * (i % 2 ? 19 : -11)) % w + w) % w;
        const y = ((i * 73.9 + Math.sin(t * 0.7 + i) * 20) % h + h) % h;
        const cut = rand(i) < state.chaos.glitch * (0.12 + energy * 0.25);
        c.globalAlpha = cut ? 0.95 : 0.35 + (i % 5) * 0.13;
        c.fillStyle = i % 4 === 0 ? colors[i % colors.length]! : (i % 2 ? '#aab5c6' : '#f0f3f8');
        c.font = `${i % 11 === 0 ? 'bold ' : ''}${10 + (i % 6) * 3 + (i % 17 === 0 ? 18 : 0)}px monospace`;
        c.fillText(String(Math.floor(rand(i + 2000) * (i % 3 === 0 ? 9999 : 10))), x + (cut ? (rand(i + 9) - 0.5) * 110 : 0), y);
      }
    }
    c.globalAlpha = 0.75;
    for (let i = 0; i < 14; i++) {
      const x = rand(i + 800) * w, y = rand(i + 900) * h, size = 8 + rand(i + 1000) * 45;
      c.strokeStyle = colors[i % colors.length]!; c.lineWidth = 1;
      if (i % 3 === 0) { c.beginPath(); c.moveTo(x, y - size); c.lineTo(x + size, y + size); c.lineTo(x - size, y + size); c.closePath(); c.stroke(); }
      else c.strokeRect(x, y, size, size * (i % 2 ? 0.4 : 1));
    }
    // Real displaced scanline slices combine all layers into synchronized glitches.
    c.globalAlpha = 1;
    if (rand(999) < state.chaos.glitch * (0.45 + energy * 0.45)) {
      for (let i = 0; i < 7; i++) {
        const y = Math.floor(rand(3000 + i) * (h - 35)), band = 3 + Math.floor(rand(4000 + i) * 28);
        c.drawImage(this.canvas, 0, y, w, band, (rand(5000 + i) - 0.5) * 130, y, w, band);
        c.fillStyle = colors[i % colors.length]!; c.globalAlpha = 0.5;
        c.fillRect(rand(6000 + i) * w, y, 25 + rand(7000 + i) * 120, 2);
        c.globalAlpha = 1;
      }
    }
    this.texture.needsUpdate = true;
  }
}
