import * as THREE from 'three';
import type { PoseState } from '../tracking/PoseState';

export const GENERATIVE_STYLES = ['Twisted Geometry', 'Fractured Planes', 'Polygon Tunnel', 'Digital Ink', 'Orbit Weave', 'Prism Grid'] as const;
export class GenerativeBackground {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  readonly settings = { style: 'Twisted Geometry', reaction: 'Body + Sound', palette: 'Acid', speed: 1, density: 1, size: 1, sensitivity: 1, base: 'Black', paused: false };
  private ctx: CanvasRenderingContext2D;
  private time = 0;
  private last = 0;
  private pulse = 0;
  constructor() {
    this.canvas.width = 960; this.canvas.height = 540;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }
  update(now: number, aspect: number, pose: PoseState, bodyEnergy: number, sound: number): void {
    if (now - this.last < 1 / 30 && this.last !== 0) return;
    const dt = Math.min(.1, Math.max(0, now - this.last)); this.last = now;
    const s = this.settings, c = this.ctx;
    const h = Math.round(960 / Math.max(.25, aspect));
    if (this.canvas.height !== h) this.canvas.height = h;
    const w = this.canvas.width;
    const useBody = s.reaction === 'Body' || s.reaction === 'Body + Sound';
    const useSound = s.reaction === 'Sound' || s.reaction === 'Body + Sound';
    const target = Math.min(2, ((useBody ? bodyEnergy : 0) + (useSound ? sound : 0)) * s.sensitivity);
    this.pulse += (target - this.pulse) * (1 - Math.exp(-dt * 10));
    if (!s.paused) this.time += dt * s.speed * (s.reaction === 'Automatic' ? 1 : .25 + this.pulse * 2);
    const t = this.time, p = this.pulse;
    const wrist = pose.hasDetection && useBody ? pose.landmarks[15] : undefined;
    const bx = wrist ? (.5 - wrist.x) * w * .35 : 0;
    const by = wrist ? (wrist.y - .5) * h * .35 : 0;
    const colors = s.palette === 'Red / Ink' ? ['#fa1734','#900c28','#161219','#ff603e'] : s.palette === 'Graphite' ? ['#111111','#555555','#999999','#292929'] : s.palette === 'Electric' ? ['#ff1493','#00dfff','#622bff','#ff6800'] : ['#c8ff00','#ff205a','#651bff','#00edce'];
    c.globalAlpha = 1; c.fillStyle = s.base === 'White' ? '#ffffff' : '#080810'; c.fillRect(0,0,w,h);
    c.save(); c.translate(w / 2 + bx, h / 2 + by); c.scale(s.size,s.size);
    c.lineWidth = 1.5 + p * 2;
    const n = Math.round(24 * s.density);
    const polygon = (x:number,y:number,r:number,sides:number,angle:number,fill:boolean) => {
      c.beginPath(); for(let k=0;k<=sides;k++){const a=angle+k*Math.PI*2/sides; const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;k?c.lineTo(px,py):c.moveTo(px,py);} fill?c.fill():c.stroke();
    };
    for(let i=0;i<n;i++) {
      const f=i/n, a=f*Math.PI*2+t*.4, color=colors[i%colors.length]!;
      c.strokeStyle=color;c.fillStyle=color;
      if(s.style==='Twisted Geometry') {
        const r=30+f*Math.min(w,h)*.7;
        c.save();c.rotate(Math.sin(t*.5+f*4)*.9);c.scale(1,.45+.3*Math.sin(t+f*6));polygon(0,0,r,4,t*.3+f*3,false);c.restore();
      } else if(s.style==='Fractured Planes') {
        const x=(Math.sin(i*12.7)*.5)*w, y=(Math.cos(i*7.3)*.5)*h;
        c.globalAlpha=.75;polygon(x+Math.sin(t+i)*35*p,y+Math.cos(t+i)*35*p,25+f*80,3,t*(i%2?1:-1)*.4+i,true);
      } else if(s.style==='Polygon Tunnel') {
        const depth=(f+t*.1)%1, r=8+depth*depth*Math.max(w,h);
        c.globalAlpha=.2+depth*.8;polygon(Math.sin(t)*depth*60,Math.cos(t*.7)*depth*40,r,6,t*.25+depth*.8,false);
      } else if(s.style==='Digital Ink') {
        c.beginPath();for(let k=0;k<65;k++){const x=(k/64-.5)*w*1.5;const y=Math.sin(k*.17+t+i*.43)*(40+p*70)+Math.sin(k*.043-t*.7)*90+(f-.5)*h; k?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
      } else if(s.style==='Orbit Weave') {
        c.save();c.rotate(a);c.beginPath();c.ellipse(0,0,30+f*w*.6,20+f*h*.2,t*.3,0,Math.PI*2);c.stroke();polygon(Math.cos(t+i)*f*w*.4,Math.sin(t+i)*f*h*.4,8+p*12,4,a,true);c.restore();
      } else {
        const columns=Math.ceil(Math.sqrt(n*aspect)), rows=Math.ceil(n/columns);
        const x=((i%columns+.5)/columns-.5)*w,y=((Math.floor(i/columns)+.5)/rows-.5)*h;
        const r=Math.min(w/columns,h/rows)*(.25+.14*Math.sin(t*2+i)+p*.12);
        polygon(x,y,r,4,t*.3+Math.sin(i+t),true); c.strokeStyle=s.base==='White'?'#111111':'#ffffff';polygon(x+8,y-8,r,4,t*.3+Math.sin(i+t),false);
      }
    }
    c.restore();c.globalAlpha=1;this.texture.needsUpdate=true;
  }
  dispose(): void { this.texture.dispose(); }
}
