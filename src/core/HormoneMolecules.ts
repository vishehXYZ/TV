import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import data from '../generators/molecules/hormones.json';

export const HORMONES = data;
export const HORMONE_NAMES = data.map(molecule => molecule.name);
const elementColors: Record<number, string> = { 1:'#e6e6e6',6:'#555866',7:'#286dff',8:'#fa2445',16:'#f5c928' };
/** PubChem computed conformers, heavy atoms and bond order; no invented molecular graph. */
export function hormoneGeometry(name: string, spaceFilling = false): THREE.BufferGeometry {
  const molecule = data.find(item => item.name === name) ?? data[0]!;
  const center = new THREE.Vector3();
  const heavy = molecule.atoms.filter(atom => atom.element !== 1);
  for (const atom of heavy) center.add(new THREE.Vector3(atom.x,atom.y,atom.z));
  center.divideScalar(heavy.length);
  const points = molecule.atoms.map(atom => new THREE.Vector3(atom.x,atom.y,atom.z).sub(center));
  const fragments: THREE.BufferGeometry[] = [];
  const tint = (geometry: THREE.BufferGeometry, color: string) => {
    const rgb = new THREE.Color(color), values = new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<values.length;i+=3){values[i]=rgb.r;values[i+1]=rgb.g;values[i+2]=rgb.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(values,3));fragments.push(geometry);
  };
  molecule.atoms.forEach((atom,index) => {
    if(atom.element===1) return;
    const radius=spaceFilling ? (atom.element===8?1.52:atom.element===7?1.55:1.7) : (atom.element===6?.34:.40);
    const sphere=new THREE.SphereGeometry(radius,12,8);sphere.translate(points[index]!.x,points[index]!.y,points[index]!.z);
    tint(sphere,elementColors[atom.element] ?? '#c04dff');
  });
  if(!spaceFilling) for(const [a,b,order] of molecule.bonds) {
    if(molecule.atoms[a!]!.element===1 || molecule.atoms[b!]!.element===1)continue;
    const start=points[a!]!,end=points[b!]!,direction=end.clone().sub(start),length=direction.length();
    const axis=direction.clone().normalize();
    const sideways=new THREE.Vector3().crossVectors(axis,Math.abs(axis.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)).normalize();
    for(let strand=0;strand<Math.min(order!,3);strand++) {
      const cylinder=new THREE.CylinderGeometry(.105,.105,length,7,1);
      cylinder.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis));
      const midpoint=start.clone().add(end).multiplyScalar(.5).addScaledVector(sideways,(strand-(order!-1)/2)*.26);
      cylinder.translate(midpoint.x,midpoint.y,midpoint.z);tint(cylinder,'#b4b6c5');
    }
  }
  const merged=mergeGeometries(fragments,false)!;
  for(const fragment of fragments)fragment.dispose();
  merged.computeBoundingBox();const size=merged.boundingBox!.getSize(new THREE.Vector3());
  merged.scale(3.4/Math.max(size.x,size.y,size.z),3.4/Math.max(size.x,size.y,size.z),3.4/Math.max(size.x,size.y,size.z));
  merged.center();merged.userData={hormone:molecule.name,cid:molecule.cid,atomCount:heavy.length,bondCount:molecule.bonds.filter(([a,b])=>molecule.atoms[a!]!.element!==1&&molecule.atoms[b!]!.element!==1).length};
  return merged;
}
