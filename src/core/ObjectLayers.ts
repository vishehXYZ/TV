import * as THREE from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface ObjectLayer {
 id: number; name: string; visible: boolean; material: 'Glass' | 'Solid'; color: string; opacity: number;
 x: number; y: number; z: number; scaleX: number; scaleY: number; scaleZ: number;
 rotateX: number; rotateY: number; rotateZ: number; object: THREE.Group;
}

/** Independent static 3D objects composited over the artwork, with genuine lighting and transmission. */
export class ObjectLayers extends Pass {
 readonly layers: ObjectLayer[]=[];
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(2*Math.atan(1/5)*180/Math.PI,1,0.1,100);
 private environment: THREE.WebGLRenderTarget | null=null;
 private serial=0;
 constructor(){
  super(); this.enabled=false;this.camera.position.z=5;
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x777777,2));
  const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,4,5);this.scene.add(light);
 }
 override setSize(width:number,height:number):void {this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
 addPrimitive(shape:'Box'|'Sphere'|'Egg'):ObjectLayer {
  let geometry:THREE.BufferGeometry;
  if(shape==='Box')geometry=new THREE.BoxGeometry(1.2,1.6,0.8);
  else{
   geometry=new THREE.SphereGeometry(0.75,48,32);
   if(shape==='Egg'){
    const positions=geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){const y=positions.getY(i);const taper=1-0.22*y/0.75;positions.setXYZ(i,positions.getX(i)*taper,y*1.3,positions.getZ(i)*taper);}
    geometry.computeVertexNormals();
   }
  }
  const object=new THREE.Group();object.add(new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial()));
  return this.addObject(object,shape);
 }
 private addObject(object:THREE.Group,name:string):ObjectLayer {
  object.traverse(child=>{
   if(!(child instanceof THREE.Mesh))return;
   const materials=Array.isArray(child.material)?child.material:[child.material];
   for(const material of materials){
    for(const value of Object.values(material))if(value instanceof THREE.Texture)value.dispose();
    material.dispose();
   }
   child.material=new THREE.MeshPhysicalMaterial();
  });
  const layer:ObjectLayer={id:++this.serial,name,visible:true,material:'Glass',color:'#dddddd',opacity:0.9,
   x:0,y:0,z:0,scaleX:1,scaleY:1,scaleZ:1,rotateX:0,rotateY:0,rotateZ:0,object};
  this.layers.push(layer);this.scene.add(object);this.apply(layer);return layer;
 }
 apply(layer:ObjectLayer):void {
  layer.object.visible=layer.visible;
  layer.object.position.set(layer.x*this.camera.aspect,layer.y,layer.z);
  layer.object.scale.set(layer.scaleX,layer.scaleY,layer.scaleZ);
  layer.object.rotation.set(...[layer.rotateX,layer.rotateY,layer.rotateZ].map(THREE.MathUtils.degToRad) as [number,number,number]);
  layer.object.traverse(child=>{
   if(!(child instanceof THREE.Mesh))return;
   if(!(child.material instanceof THREE.MeshPhysicalMaterial)){
    const previous=Array.isArray(child.material)?child.material:[child.material];for(const material of previous)material.dispose();
    child.material=new THREE.MeshPhysicalMaterial();
   }
   const material=child.material as THREE.MeshPhysicalMaterial;
   material.color.set(layer.color);material.transparent=layer.material==='Glass'||layer.opacity<1;
   material.opacity=layer.opacity;material.transmission=layer.material==='Glass'?0.95:0;
   material.roughness=layer.material==='Glass'?0.08:0.4;material.metalness=0;
   material.thickness=0.45;material.ior=1.45;material.clearcoat=1;material.envMapIntensity=1;
   material.depthWrite=layer.material==='Solid'&&layer.opacity===1;
   material.needsUpdate=true;
  });
  this.enabled=this.layers.some(item=>item.visible);
 }
 duplicate(id:number):ObjectLayer|null {
  const source=this.layers.find(item=>item.id===id);if(!source)return null;
  const object=cloneSkeleton(source.object) as THREE.Group;
  object.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry=child.geometry.clone();child.material=(child.material as THREE.Material).clone();}});
  const copy=this.addObject(object,source.name+' copy');const newId=copy.id;
  Object.assign(copy,source,{id:newId,name:source.name+' copy',object,x:Math.min(1,source.x+0.15)});this.apply(copy);return copy;
 }
 remove(id:number):void {
  const index=this.layers.findIndex(item=>item.id===id);if(index<0)return;
  const [layer]=this.layers.splice(index,1);this.scene.remove(layer!.object);
  layer!.object.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();const materials=Array.isArray(child.material)?child.material:[child.material];for(const material of materials)material.dispose();}});
  this.enabled=this.layers.some(item=>item.visible);
 }
 async importFile(file:File):Promise<ObjectLayer> {
  let source:THREE.Object3D;
  if(file.name.toLowerCase().endsWith('.obj'))source=new OBJLoader().parse(await file.text());
  else if(file.name.toLowerCase().endsWith('.glb')){
   const bytes=await file.arrayBuffer();const view=new DataView(bytes);
   if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67)throw new Error('Choose a valid GLB model.');
   const jsonLength=view.getUint32(12,true);
   const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,jsonLength)));
   for(const item of [...(json.buffers??[]),...(json.images??[])])if(item.uri&&!item.uri.startsWith('data:'))throw new Error('Use a self-contained GLB with embedded assets.');
   if(json.extensionsRequired?.some((name:string)=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(name)))throw new Error('Export an uncompressed GLB (without Draco, Meshopt or KTX textures).');
   source=(await new GLTFLoader().parseAsync(bytes,'')).scene;
  }else throw new Error('Supported files: self-contained .glb or .obj.');
  const object=new THREE.Group();object.add(source);
  object.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(object);
  if(bounds.isEmpty())throw new Error('No renderable geometry found in this model.');
  const size=bounds.getSize(new THREE.Vector3());const center=bounds.getCenter(new THREE.Vector3());
  const normalization=1.5/Math.max(size.x,size.y,size.z,0.001);
  source.position.sub(center);const normalized=new THREE.Group();normalized.add(object);normalized.scale.setScalar(normalization);
  // Bake normalization into a child group so per-layer scale remains independent.
  const wrapper=new THREE.Group();wrapper.add(normalized);
  return this.addObject(wrapper,file.name.replace(/\.(glb|obj)$/i,''));
 }
 override render(renderer:THREE.WebGLRenderer,writeBuffer:THREE.WebGLRenderTarget,readBuffer:THREE.WebGLRenderTarget):void {
  if(!this.environment){const generator=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();this.environment=generator.fromScene(room,0.04);room.dispose();generator.dispose();this.scene.environment=this.environment.texture;}
  this.scene.background=readBuffer.texture;
  // Aspect may change for recording/export. Keep screen-relative positions stable.
  for(const layer of this.layers)layer.object.position.x=layer.x*this.camera.aspect;
  const autoClear=renderer.autoClear;
  renderer.autoClear=true;
  try{renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);renderer.render(this.scene,this.camera);}finally{renderer.autoClear=autoClear;}
 }
 override dispose():void {for(const layer of [...this.layers])this.remove(layer.id);this.environment?.dispose();}
}
