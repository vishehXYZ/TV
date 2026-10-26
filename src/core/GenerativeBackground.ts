import * as THREE from 'three';
import type { PoseState } from '../tracking/PoseState';

export const GENERATIVE_STYLES = ['Chromatic Organism', 'Razor Bloom', 'Impossible Architecture', 'Liquid Satellites', 'Shattered Sun', 'Velvet Vortex'] as const;
/** Independent 3D stage rendered with the app's renderer; no second WebGL context. */
export class GenerativeBackground {
  readonly target = new THREE.WebGLRenderTarget(960, 540, { depthBuffer: true });
  readonly texture = this.target.texture;
  readonly settings = { style: 'Chromatic Organism', reaction: 'Body + Sound', palette: 'Acid', speed: 1, density: 1, size: 1, sensitivity: 1, base: 'Black', paused: false };
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(43, 16 / 9, .1, 100);
  readonly sculpture = new THREE.Group();
  private pieces: THREE.Mesh[] = [];
  private signature = '';
  private time = 0;
  private last = -1;
  private pulse = 0;
  private pointer = new THREE.Vector2();
  constructor() {
    this.camera.position.set(0, 0, 10);
    this.scene.add(this.sculpture, new THREE.HemisphereLight(0xd9eaff, 0x21042a, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 4);key.position.set(-3,5,6);this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff277c, 3);rim.position.set(4,-2,-3);this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0x44dfff, 2);fill.position.set(-5,-1,1);this.scene.add(fill);
  }
  private clearPieces(): void {
    for(const mesh of this.pieces){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();this.sculpture.remove(mesh);}this.pieces=[];
  }
  private rebuild(): void {
    this.clearPieces();
    const s=this.settings;
    const colors=s.palette==='Red / Ink'?['#ed1237','#191119','#ff5634','#840c24']:s.palette==='Graphite'?['#17171c','#bcbcc2','#595965','#f4f4f4']:s.palette==='Electric'?['#ff167d','#2255ff','#10dfff','#ff7315']:['#c6ff05','#ff2063','#6622ff','#00e4c2'];
    const count=Math.round((s.style==='Impossible Architecture'?22:s.style==='Shattered Sun'?48:s.style==='Liquid Satellites'?18:12)*s.density);
    for(let i=0;i<count;i++) {
      let geometry:THREE.BufferGeometry;
      switch(s.style){
        case 'Chromatic Organism': geometry=new THREE.TorusKnotGeometry(.95,.21,100,10,2+(i%3),3+(i%2)*2);break;
        case 'Razor Bloom': geometry=new THREE.ConeGeometry(.55,3.6,3,1);break;
        case 'Impossible Architecture': geometry=new THREE.BoxGeometry(2.5,.24,.45);break;
        case 'Liquid Satellites': geometry=i%3===0?new THREE.TorusGeometry(.8,.28,16,48):new THREE.SphereGeometry(.6,24,16);break;
        case 'Shattered Sun': geometry=new THREE.IcosahedronGeometry(.65,0);break;
        default: geometry=new THREE.TorusGeometry(1,.22,12,72,Math.PI*1.65);
      }
      const material=new THREE.MeshPhysicalMaterial({color:colors[i%colors.length],roughness:s.style==='Razor Bloom'?.28:.23,metalness:.22,clearcoat:1,clearcoatRoughness:.12});
      const mesh=new THREE.Mesh(geometry,material);this.pieces.push(mesh);this.sculpture.add(mesh);
    }
  }
  update(now:number,aspect:number,pose:PoseState,bodyEnergy:number,sound:number,renderer?:THREE.WebGLRenderer): void {
    if(this.last>=0 && now-this.last<1/30)return;
    const dt=this.last<0?1/30:Math.min(.1,Math.max(0,now-this.last));this.last=now;
    const s=this.settings, signature=`${s.style}/${s.palette}/${s.density}`;
    if(signature!==this.signature){this.signature=signature;this.rebuild();}
    const body=s.reaction==='Body'||s.reaction==='Body + Sound', audio=s.reaction==='Sound'||s.reaction==='Body + Sound';
    if(!s.paused){
      const energy=Math.min(2,((body?bodyEnergy:0)+(audio?sound:0))*s.sensitivity);
      this.pulse+=(energy-this.pulse)*(1-Math.exp(-dt*9));
      this.time+=dt*s.speed*(s.reaction==='Automatic'?1:.35+this.pulse*1.4);
      const wrist=body&&pose.hasDetection?pose.landmarks[15]:undefined;
      this.pointer.lerp(new THREE.Vector2(wrist?(.5-wrist.x)*2:0,wrist?(.5-wrist.y)*2:0),1-Math.exp(-dt*5));
    }
    const t=this.time,p=this.pulse,n=this.pieces.length;
    this.sculpture.scale.setScalar(s.size*(1+p*.1));
    this.sculpture.rotation.set(this.pointer.y*.35+Math.sin(t*.17)*.16,this.pointer.x*.6+t*.12,Math.sin(t*.13)*.15);
    for(let i=0;i<n;i++){
      const mesh=this.pieces[i]!,f=i/n,a=f*Math.PI*2;
      mesh.scale.setScalar(1);mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);
      if(s.style==='Chromatic Organism'){
        mesh.position.set(Math.cos(a+t*.15)*1.55,Math.sin(a+t*.15)*1.55,Math.sin(a*3+t)*.9);
        mesh.rotation.set(t*.23+a,a*2-t*.19,a+t*.16);mesh.scale.setScalar(.65+.2*Math.sin(t+a)+p*.12);
      }else if(s.style==='Razor Bloom'){
        mesh.position.set(Math.sin(a)*1.15,Math.cos(a)*1.15,Math.sin(a*3+t)*.7);
        mesh.rotation.set(Math.sin(t*.5+a)*.8,Math.cos(a+t*.3),-a);mesh.scale.set(1,.8+.3*Math.sin(t+a)+p*.3,1);
      }else if(s.style==='Impossible Architecture'){
        mesh.position.set(Math.sin(i*2.4+t*.2)*2.2,(f-.5)*5,Math.cos(i*2.4+t*.2)*1.4);
        mesh.rotation.set(t*.15+i*.7,t*.2+i*.4,Math.sin(t*.3+i)*.6);
      }else if(s.style==='Liquid Satellites'){
        const r=1.3+Math.sin(i*3.7)*.9;
        mesh.position.set(Math.cos(a+t*.3)*r,Math.sin(a*2+t*.25)*1.7,Math.sin(a+t*.3)*r);
        mesh.rotation.set(a+t*.3,t*.4,a);mesh.scale.setScalar(.7+f*.7+p*.2);
      }else if(s.style==='Shattered Sun'){
        const latitude=Math.acos(1-2*(i+.5)/n),longitude=i*2.39996+t*.16;
        const r=1.9+Math.sin(t*.8+i*.8)*.55+p*.75;
        mesh.position.set(Math.sin(latitude)*Math.cos(longitude)*r,Math.cos(latitude)*r,Math.sin(latitude)*Math.sin(longitude)*r);
        mesh.rotation.set(t*.4+i,t*.3+i*2,t*.2);mesh.scale.set(.5,.6+f,1.3);
      }else{
        mesh.position.z=(f-.5)*4;mesh.rotation.set(Math.sin(t*.3+f*3)*.35,Math.cos(t*.2+f*4)*.35,a+t*.4);
        mesh.scale.setScalar(.6+f*1.9+p*.15);
      }
    }
    this.scene.background=new THREE.Color(s.base==='White'?'#ffffff':'#08070e');
    this.camera.aspect=aspect;this.camera.position.z=aspect<1?10/aspect:10;this.camera.updateProjectionMatrix();
    const height=Math.round(960/Math.max(.3,aspect));if(this.target.height!==height)this.target.setSize(960,height);
    if(renderer){
      const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
      const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
      const xr=renderer.xr.enabled;
      try{renderer.xr.enabled=false;renderer.autoClear=true;renderer.setRenderTarget(this.target);renderer.setScissorTest(false);renderer.render(this.scene,this.camera);}
      finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;renderer.xr.enabled=xr;}
    }
  }
  dispose():void{this.clearPieces();this.target.dispose();}
}
