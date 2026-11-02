import { PoseState } from './PoseState';
/** Visual audio energy is never fed back into the real motion detector. */
export function syncVisualPose(target:PoseState,tracked:PoseState,audioEnergy:number):void{
  Object.assign(target,tracked);
  target.energy=Math.max(tracked.hasDetection?tracked.energy:0,Math.max(0,audioEnergy));
}
