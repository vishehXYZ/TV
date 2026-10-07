import * as THREE from 'three';
import { deformInkPoint, type InkJoint } from '../generators/chaos/MotionField';
import type { SceneManager } from '../core/SceneManager';
import type { AppState } from '../core/AppState';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import vertexShader from '../generators/chroma/chroma.vert.glsl';
import maskSample from '../generators/shared/maskSample.glsl';
import type { PoseTracker } from '../tracking/PoseTracker';

/** A bounded canvas texture: moving ink, digits, sliced bands and geometric interruptions. */
export class ChaosMode {
  private canvas = document.createElement('canvas');
  private context: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private mesh: THREE.Mesh;
  private lastFrame = -Infinity;
  private previousJoints = new Map<number, { x: number; y: number; time: number }>();
  private mask = new SegmentationMaskTexture();
  private material: THREE.ShaderMaterial;
  private scene: SceneManager;
  private style: number;
  constructor(scene: SceneManager, style: number) {
    this.scene = scene; this.style = style;
    this.canvas.width = 1280; this.canvas.height = 720;
    this.context = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.material = new THREE.ShaderMaterial({
      vertexShader, transparent: true, depthWrite: false,
      uniforms: { uShowBody: { value: 0 }, uFull: { value: 1 }, uCenter: { value: new THREE.Vector2() }, uInk: { value: this.texture }, uMask: { value: null }, uMaskResolution: { value: new THREE.Vector2(1,1) }, uAspect: { value: 1 }, uHasMask: { value: 0 } },
      fragmentShader: `uniform sampler2D uInk; uniform sampler2D uMask; uniform vec2 uMaskResolution;
      uniform float uAspect; uniform float uHasMask; uniform float uFull; uniform float uShowBody; uniform vec2 uCenter; varying vec2 vStagePos;
      ${maskSample}
      void main(){
        vec2 inkPos=vStagePos;
        vec2 uv=vec2(inkPos.x/(2.0*uAspect)+0.5,inkPos.y*0.5+0.5);
        vec4 ink=texture2D(uInk,uv);
        float body=uHasMask>0.5?smoothstep(0.25,0.65,sampleMask(vStagePos)):0.0;
        float inner=uHasMask>0.5?smoothstep(0.25,0.65,sampleMask(vStagePos+vec2(0.014,0.0)))*smoothstep(0.25,0.65,sampleMask(vStagePos-vec2(0.014,0.0)))*smoothstep(0.25,0.65,sampleMask(vStagePos+vec2(0.0,0.014)))*smoothstep(0.25,0.65,sampleMask(vStagePos-vec2(0.0,0.014))):0.0;
        float edge=max(0.0,body-inner);
        float ambient=uFull>0.5?1.0:(uHasMask>0.5?0.06:0.55);
        float a=ink.a*max(body,ambient);
        float outline=uFull<0.5 || uShowBody>0.5?1.0:0.0;
        float base=body*0.16*outline;
        vec3 color=ink.a>0.01?ink.rgb:vec3(0.12);
        color=mix(color,vec3(0.05,0.85,0.95),edge*outline);
        gl_FragColor=vec4(color,max(a,max(base,edge*0.85*outline)));
      }`,
    });
    const material = this.material;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.position.z = -0.3; this.mesh.visible = false;
    scene.scene.add(this.mesh);
  }
  setVisible(visible: boolean): void { this.mesh.visible = visible; }
  update(tracker: PoseTracker, state: AppState, time: number): void {
    this.mesh.scale.set(this.scene.aspect, 1, 1);
    const mask = this.mask.update(tracker.state), u = this.material.uniforms;
    u.uMask!.value = mask; u.uMaskResolution!.value.set(this.mask.width,this.mask.height);
    u.uAspect!.value = this.scene.aspect; u.uHasMask!.value = mask && tracker.state.hasDetection ? 1 : 0;
    u.uFull!.value = state.chaos.coverage === 'Full space' ? 1 : 0;
    u.uShowBody!.value = state.chaos.showBody ? 1 : 0;
    const center = u.uCenter!.value as THREE.Vector2;
    const left = tracker.state.landmarks[11], right = tracker.state.landmarks[12];
    if (tracker.state.hasDetection && left && right) {
      let x = 1 - (left.x + right.x) / 2, y = 1 - (left.y + right.y) / 2;
      const aspect = this.scene.aspect, maskAspect = this.mask.width / this.mask.height;
      if (maskAspect > aspect) x = (x - 0.5) * maskAspect / aspect + 0.5;
      else y = (y - 0.5) * aspect / maskAspect + 0.5;
      center.set((x - 0.5) * 2 * aspect, (y - 0.5) * 2);
    } else center.set(0,0);
    if (time - this.lastFrame < 1 / 24) return;
    this.lastFrame = time;
    const c = this.context, w = this.canvas.width, h = this.canvas.height;
    const energy = Math.min(1, Math.max(0, tracker.state.energy));
    const t = time * state.chaos.speed;
    const tick = Math.floor(t * (8 + energy * 18));
    const rand = (n: number) => { const x = Math.sin(n * 127.1 + tick * 31.7) * 43758.5453; return x - Math.floor(x); };
    const graphite = state.chaos.appearance === 'Graphite pencil';
    const redInk = state.chaos.appearance === 'Red ink';
    const colors = graphite ? ['#ffffff','#dddddd','#aaaaaa','#f6f6f6','#c2c2c2'] : redInk ? ['#ff1823','#f53122','#cf001f','#ff4930','#e7003a'] : state.chaos.usePalette ? state.palette.map(color => `#${color.getHexString()}`) : ['#ff236b', '#00d5df', '#feae24', '#8c51ff', '#48ed88'];
    c.clearRect(0, 0, w, h);
    const joints: InkJoint[] = [];
    if (tracker.state.hasDetection) {
      const aspect = this.scene.aspect;
      const cameraAspect = tracker.state.segmentationMask ? this.mask.width / this.mask.height : aspect;
      for (const index of [11, 12, 15, 16, 23, 24]) {
        const point = tracker.state.landmarks[index];
        if (!point || point.visibility < 0.4) { this.previousJoints.delete(index); continue; }
        let x = 1 - point.x, y = point.y;
        if (cameraAspect > aspect) x = (x - 0.5) * cameraAspect / aspect + 0.5;
        else y = (y - 0.5) * aspect / cameraAspect + 0.5;
        x *= w; y *= h;
        const previous = this.previousJoints.get(index);
        const dt = previous ? time - previous.time : 0;
        const valid = dt > 0 && dt < 0.25;
        const vx = valid ? THREE.MathUtils.clamp((x - previous!.x) / dt, -w * 2, w * 2) : 0;
        const vy = valid ? THREE.MathUtils.clamp((y - previous!.y) / dt, -h * 2, h * 2) : 0;
        joints.push({ x, y, vx, vy });
        this.previousJoints.set(index, { x, y, time });
      }
    } else this.previousJoints.clear();
    const deform = (x: number, y: number): [number, number] => deformInkPoint(x, y, joints, w, h, state.chaos.motion);
    // Long continuous strokes run beyond all four edges. No texture tiling or body clipping in Full space.
    if (this.style !== 1) {
      const count = Math.round(64 * state.chaos.density);
      for (let i = 0; i < count; i++) {
        c.strokeStyle = colors[i % colors.length]!;
        c.lineWidth = graphite ? 0.65 + (i % 4) * 0.3 : 0.8 + (i % 5) * 0.5;
        c.globalAlpha = graphite ? 0.45 + (i % 5) * 0.1 : 0.7 + (i % 3) * 0.1;
        c.beginPath();
        const vertical = i % 3 === 0;
        for (let j = 0; j <= 100; j++) {
          const along = j / 100;
          const phase = along * 12 + i * 2.4 + t * 0.3;
          const wave = Math.sin(phase * 1.7) * 38 + Math.sin(phase * 3.7 + i) * 16 + Math.cos(phase * 0.8) * 65;
          let x = vertical ? (i / count) * w + wave : -80 + along * (w + 160);
          let y = vertical ? -80 + along * (h + 160) : (i / count) * h + wave;
          [x, y] = deform(x, y);
          if (graphite) { x += Math.sin(j * 19 + i) * 1.2; y += Math.cos(j * 13 + i) * 1.2; }
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
        c.fillStyle = graphite || redInk || state.chaos.usePalette ? colors[i % colors.length]! : (i % 4 === 0 ? colors[i % colors.length]! : (i % 2 ? '#aab5c6' : '#f0f3f8'));
        c.font = `${i % 11 === 0 ? 'bold ' : ''}${10 + (i % 6) * 3 + (i % 17 === 0 ? 18 : 0)}px monospace`;
        const [px,py] = deform(x,y);
        c.fillText(String(Math.floor(rand(i + 2000) * (i % 3 === 0 ? 9999 : 10))), px + (cut ? (rand(i + 9) - 0.5) * 110 : 0), py);
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
    if (!graphite && state.chaos.cuts && rand(999) < state.chaos.glitch * (0.45 + energy * 0.45)) {
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
