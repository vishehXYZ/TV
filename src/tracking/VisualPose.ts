import { PoseState } from './PoseState';
/** Visual audio energy is never fed back into the real motion detector. */
export function syncVisualPose(target:PoseState,tracked:PoseState,audioEnergy:number,musicOnly=false):void{
  if(musicOnly){
    target.hasDetection=false;target.landmarks=[];target.velocities=new Float32Array(0);target.segmentationMask=null;
    target.energy=Math.max(0,audioEnergy);return;
  }
  Object.assign(target,tracked);
  target.energy=(tracked.hasDetection?tracked.energy:0)+Math.max(0,audioEnergy);
}
