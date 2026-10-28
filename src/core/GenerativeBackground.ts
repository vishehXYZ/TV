import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { hormoneGeometry } from './HormoneMolecules';
import { FontLoader, type FontData } from 'three/examples/jsm/loaders/FontLoader.js';
import glyphData from '../generators/typography/glyphs.json';
import type { PoseState } from '../tracking/PoseState';

export const GENERATIVE_STYLES = ['Chromatic Organism', 'Razor Bloom', 'Impossible Architecture', 'Liquid Satellites', 'Shattered Sun', 'Velvet Vortex', 'Crystal Swarm', 'Ribbon Tide', 'Orbital Cathedral', 'Pulse Totems', 'Molecular Dream', 'Origami Storm', 'Alphabet Storm', 'Letter Orbit', 'Glyph Rain', 'Language Constellation', 'Persian Letters', 'Hebrew Letters', 'Arabic Letters', 'English Letters', 'Russian Letters', 'Cortisol Molecules', 'Adrenaline Molecules', 'Melatonin Molecules', 'Estradiol Molecules', 'Testosterone Molecules', 'Progesterone Molecules'] as const;
export const LANGUAGE_STYLES: Record<string,string> = { 'Persian Letters':'Persian','Hebrew Letters':'Hebrew','Arabic Letters':'Arabic','English Letters':'English','Russian Letters':'Russian' };
export const HORMONE_STYLES: Record<string,string> = { 'Cortisol Molecules':'Cortisol','Adrenaline Molecules':'Adrenaline','Melatonin Molecules':'Melatonin','Estradiol Molecules':'Estradiol','Testosterone Molecules':'Testosterone','Progesterone Molecules':'Progesterone' };
export const TYPOGRAPHY_STYLES: readonly string[] = ['Alphabet Storm', 'Letter Orbit', 'Glyph Rain', 'Language Constellation', ...Object.keys(LANGUAGE_STYLES)];
const LETTERS: Record<string, string> = {
  Persian: 'ابتثجچحخدذرزژسشصضطظعغفقکگلمنوهیپ',
  English: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  Russian: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
  Hebrew: 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ',
  Arabic: 'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي',
};
const font = new FontLoader().parse(glyphData as FontData);
function letterGeometry(char: string): THREE.BufferGeometry {
  const shapes = font.generateShapes(char, 1);
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: .25, bevelEnabled: true, bevelThickness: .035, bevelSize: .025, bevelSegments: 2, curveSegments: 5 });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const extent = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, .01);
  geometry.translate(-(box.max.x + box.min.x) / 2, -(box.max.y + box.min.y) / 2, -.125);
  geometry.scale(.8 / extent, .8 / extent, 1);
  return geometry;
}
/** Independent 3D stage rendered with the app's renderer; no second WebGL context. */
export class GenerativeBackground {
  readonly target = new THREE.WebGLRenderTarget(960, 540, { depthBuffer: true });
  readonly texture = this.target.texture;
  readonly objectsTarget = new THREE.WebGLRenderTarget(960,540,{depthBuffer:true});
  readonly objectsTexture = this.objectsTarget.texture;
  private readonly fillMaterial = new THREE.ShaderMaterial({
    uniforms:{uObjects:{value:this.objectsTexture},uBase:{value:new THREE.Color()}},
    vertexShader:'varying vec2 uvPass; void main(){uvPass=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:'varying vec2 uvPass; uniform sampler2D uObjects; uniform vec3 uBase; void main(){vec4 c=texture2D(uObjects,uvPass);gl_FragColor=vec4(c.rgb+uBase*(1.0-c.a),1.0);}',
    depthTest:false,depthWrite:false,toneMapped:false,
  });
  private readonly fillQuad = new FullScreenQuad(this.fillMaterial);
  readonly settings = { style: 'Chromatic Organism', reaction: 'Body + Sound', palette: 'Acid', speed: 1, density: 1, size: 1, sensitivity: 1, base: 'Black', alphabet: 'Mixed', bodyPlacement: 'Behind body', letterMotion: 'Alphabet Storm', moleculeArrangement: 'Atlas', molecularColors: 'Elements', molecularForm: 'Ball + Stick', paused: false };
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
    const extras: Record<string, number> = { 'Crystal Swarm': 36, 'Ribbon Tide': 24, 'Orbital Cathedral': 18, 'Pulse Totems': 32, 'Molecular Dream': 42, 'Origami Storm': 30, 'Alphabet Storm': 42, 'Letter Orbit': 30, 'Glyph Rain': 54, 'Language Constellation': 36 };
    const moleculeName=HORMONE_STYLES[s.style], style=LANGUAGE_STYLES[s.style]?s.letterMotion:s.style;
    const count=moleculeName?(s.moleculeArrangement==='Atlas'?1:Math.round(7*s.density)):Math.round((extras[style] ?? (s.style==='Impossible Architecture'?22:s.style==='Shattered Sun'?48:s.style==='Liquid Satellites'?18:12))*s.density);
    const alphabet=LANGUAGE_STYLES[s.style] ?? s.alphabet;
    const letters = alphabet === 'Mixed' ? Object.values(LETTERS) : [LETTERS[alphabet] ?? LETTERS.English!];
    const cache = new Map<string, THREE.BufferGeometry>();
    for(let i=0;i<count;i++) {
      let geometry:THREE.BufferGeometry;
      if (moleculeName) {
        geometry=hormoneGeometry(moleculeName,s.molecularForm==='Space filling');
      } else if (TYPOGRAPHY_STYLES.includes(s.style)) {
        const source=letters[i % letters.length]!;
        const char=source[Math.floor(i / letters.length * 7) % source.length]!;
        let original=cache.get(char);
        if (!original) { original=letterGeometry(char); cache.set(char,original); }
        geometry=original.clone();
        geometry.userData.character=char;
      } else switch(s.style){
        case 'Chromatic Organism': geometry=new THREE.TorusKnotGeometry(.95,.21,100,10,2+(i%3),3+(i%2)*2);break;
        case 'Razor Bloom': geometry=new THREE.ConeGeometry(.55,3.6,3,1);break;
        case 'Impossible Architecture': geometry=new THREE.BoxGeometry(2.5,.24,.45);break;
        case 'Liquid Satellites': geometry=i%3===0?new THREE.TorusGeometry(.8,.28,16,48):new THREE.SphereGeometry(.6,24,16);break;
        case 'Shattered Sun': geometry=new THREE.IcosahedronGeometry(.65,0);break;
        case 'Crystal Swarm': geometry=new THREE.OctahedronGeometry(.65);break;
        case 'Ribbon Tide': geometry=new THREE.BoxGeometry(.16,.2,4.5,1,1,24);break;
        case 'Orbital Cathedral': geometry=new THREE.TorusGeometry(1,.12,10,64);break;
        case 'Pulse Totems': geometry=new THREE.CylinderGeometry(.34,.55,.55,6);break;
        case 'Molecular Dream': geometry=new THREE.CapsuleGeometry(.19,.85,4,12);break;
        case 'Origami Storm': geometry=new THREE.TetrahedronGeometry(.85);break;
        default: geometry=new THREE.TorusGeometry(1,.22,12,72,Math.PI*1.65);
      }
      const molecule=Boolean(moleculeName), elements=molecule&&s.molecularColors==='Elements';
      const material=new THREE.MeshPhysicalMaterial({vertexColors:elements,color:elements?'#ffffff':colors[i%colors.length],roughness:s.style==='Razor Bloom'?.28:.23,metalness:.22,clearcoat:1,clearcoatRoughness:.12});
      if(s.style==='Ribbon Tide')geometry.userData.basePositions=Float32Array.from(geometry.getAttribute('position').array);
      const mesh=new THREE.Mesh(geometry,material);this.pieces.push(mesh);this.sculpture.add(mesh);
    }
    for(const geometry of cache.values()) geometry.dispose();
  }
  update(now:number,aspect:number,pose:PoseState,bodyEnergy:number,sound:number,renderer?:THREE.WebGLRenderer): void {
    if(this.last>=0 && now-this.last<1/30)return;
    const dt=this.last<0?1/30:Math.min(.1,Math.max(0,now-this.last));this.last=now;
    const s=this.settings, signature=`${s.style}/${s.palette}/${s.density}/${s.alphabet}/${s.letterMotion}/${s.moleculeArrangement}/${s.molecularForm}/${s.molecularColors}`;
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
    const style=LANGUAGE_STYLES[s.style]?s.letterMotion:s.style;
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
      }else if(s.style==='Crystal Swarm'){
        const longitude=i*2.39996+t*.14,latitude=Math.acos(1-2*(i+.5)/n);
        const radius=2.1+.45*Math.sin(t+i)+p*.45;
        mesh.position.set(Math.cos(longitude)*Math.sin(latitude)*radius,Math.cos(latitude)*radius,Math.sin(longitude)*Math.sin(latitude)*radius);
        mesh.rotation.set(t*.4+i,a+t*.3,i*.6);mesh.scale.set(.55,1.4+.6*Math.sin(t+i),.55);
      }else if(s.style==='Ribbon Tide'){
        mesh.position.set((f-.5)*5,Math.sin(f*7+t)*.8,Math.cos(f*6+t*.6)*.65);
        mesh.rotation.set(Math.sin(f*5+t*.6)*.4,Math.sin(f*7+t)*.55,Math.sin(t*.4+f*5)*.25);
        mesh.scale.set(1,1+p*.5,1);
        const positions=mesh.geometry.getAttribute('position');
        // Bend the ribbons from their original longitudinal coordinate, without accumulating deformation.
        for(let v=0;v<positions.count;v++){
          const base=mesh.geometry.userData.basePositions as Float32Array;
          const z=base[v*3+2]!;
          positions.setY(v,base[v*3+1]!+Math.sin(z*1.4+t+f*5)*(.35+p*.2));
        }
        positions.needsUpdate=true;mesh.geometry.computeVertexNormals();
      }else if(s.style==='Orbital Cathedral'){
        mesh.position.set(Math.sin(a+t*.15)*1.2,Math.cos(a+t*.15)*1.2,Math.sin(a*2+t*.3)*1.2);
        mesh.rotation.set(a+t*.15,Math.sin(a+t*.25)*1.4,a*.5);
        mesh.scale.setScalar(1.1+.65*Math.sin(f*Math.PI)+p*.2);
      }else if(s.style==='Pulse Totems'){
        const column=i%4,row=Math.floor(i/4),rows=Math.ceil(n/4);
        mesh.position.set((column-1.5)*1.15,(row-(rows-1)/2)*.65,Math.sin(row*.9+column+t)*.65);
        mesh.rotation.set(Math.sin(t*.5+row)*.22,t*.35+row*.3+column*.5,Math.sin(t+column)*.13);
        mesh.scale.setScalar(.75+.22*Math.sin(t*1.5+row*.8+column)+p*.2);
      }else if(s.style==='Molecular Dream'){
        const strand=i%3,step=Math.floor(i/3),turn=step*.55+t*.35+strand*Math.PI*2/3;
        mesh.position.set(Math.cos(turn)*1.45,(step-(Math.ceil(n/3)-1)/2)*.34,Math.sin(turn)*1.45);
        mesh.rotation.set(Math.PI/2,turn,strand*.8+Math.sin(t+step)*.5);
        mesh.scale.setScalar(.8+p*.3);
      }else if(s.style==='Origami Storm'){
        const turn=i*2.39996+t*.25,radius=.5+f*2.1;
        mesh.position.set(Math.cos(turn)*radius,Math.sin(turn)*radius,Math.sin(i*1.7+t)*1.4);
        mesh.rotation.set(t*.4+i*.3,t*.3-i*.8,t*.2+i);
        mesh.scale.set(1.2,.18+.15*(1+Math.sin(t+i)),.9+p*.35);
      }else if(style==='Alphabet Storm'){
        const turn=i*2.39996+t*.2,radius=.5+f*3+p*.45;
        mesh.position.set(Math.cos(turn)*radius,Math.sin(turn)*radius,Math.sin(i*1.9+t*.7)*2);
        mesh.rotation.set(Math.sin(t*.5+i)*.45,t*.45+i*.25,Math.sin(t*.3+i)*.35);
        mesh.scale.setScalar(.65+(i%4)*.15+p*.12);
      }else if(style==='Letter Orbit'){
        const ring=i%3,angle=(Math.floor(i/3)/Math.ceil(n/3))*Math.PI*2+t*(ring%2?-.3:.25);
        const radius=1.2+ring*.7+p*.2;
        mesh.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,Math.sin(angle+ring)*.8);
        mesh.rotation.set(Math.sin(angle)*.3,Math.cos(angle)*.35,angle+Math.PI/2);
        mesh.scale.setScalar(.72+ring*.12);
      }else if(style==='Glyph Rain'){
        const col=i%9,row=Math.floor(i/9),rows=Math.ceil(n/9);
        const y=(((row/rows-t*(.04+(col%3)*.01))%1+1)%1-.5)*6;
        mesh.position.set((col-4)*.85+.12*Math.sin(t+i),y,Math.sin(col*3+row)*1.2);
        mesh.rotation.set(.12*Math.sin(t+i),Math.sin(t*.3+i)*.35,Math.sin(i+t*.3)*.15);
        mesh.scale.setScalar(.8+p*.2);
      }else if(style==='Language Constellation'){
        const lat=Math.acos(1-2*(i+.5)/n),lon=i*2.39996+t*.14,radius=2.2+p*.4;
        mesh.position.set(Math.sin(lat)*Math.cos(lon)*radius,Math.cos(lat)*radius,Math.sin(lat)*Math.sin(lon)*radius);
        mesh.rotation.set(Math.sin(lat+t)*.25,lon*.35,Math.sin(lon)*.25);mesh.scale.setScalar(.7+.12*Math.sin(t+i));
      }else if(HORMONE_STYLES[s.style]&&s.moleculeArrangement==='Atlas'){
        mesh.rotation.set(Math.sin(t*.25)*.45,t*.25,Math.sin(t*.15)*.18);
        mesh.scale.setScalar(1.25+p*.1);
      }else if(HORMONE_STYLES[s.style]){
        const radius=1.8+p*.25;
        mesh.position.set(Math.cos(a+t*.16)*radius,Math.sin(a+t*.16)*radius,Math.sin(a*2+t*.2)*1.2);
        mesh.rotation.set(a+t*.2,t*.3+i,Math.sin(a+t*.2)*.3);mesh.scale.setScalar(.38+.14*(i%3)/2);
      }else{
        mesh.position.z=(f-.5)*4;mesh.rotation.set(Math.sin(t*.3+f*3)*.35,Math.cos(t*.2+f*4)*.35,a+t*.4);
        mesh.scale.setScalar(.6+f*1.9+p*.15);
      }
    }
    this.scene.background=null;
    (this.fillMaterial.uniforms.uBase!.value as THREE.Color).set(s.base==='White'?'#ffffff':'#08070e');
    this.camera.aspect=aspect;this.camera.position.z=aspect<1?10/aspect:10;this.camera.updateProjectionMatrix();
    const height=Math.round(960/Math.max(.3,aspect));if(this.target.height!==height){this.target.setSize(960,height);this.objectsTarget.setSize(960,height);}
    if(renderer){
      const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
      const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
      const xr=renderer.xr.enabled;
      const clearColor=renderer.getClearColor(new THREE.Color()).clone(),clearAlpha=renderer.getClearAlpha();
      try{renderer.xr.enabled=false;renderer.autoClear=true;renderer.setClearColor(0,0);renderer.setRenderTarget(this.objectsTarget);renderer.setScissorTest(false);renderer.render(this.scene,this.camera);renderer.setRenderTarget(this.target);this.fillQuad.render(renderer);}
      finally{renderer.setClearColor(clearColor,clearAlpha);renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=autoClear;renderer.xr.enabled=xr;}
    }
  }
  dispose():void{this.clearPieces();this.target.dispose();this.objectsTarget.dispose();this.fillMaterial.dispose();this.fillQuad.dispose();}
}
