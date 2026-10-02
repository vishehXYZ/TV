import type { PoseState } from './PoseState';
/** Separate graph prevents generated sound from feeding back into visual movement energy. */
export class MotionSound {
 private context: AudioContext | null = null;
 private oscillator: OscillatorNode | null = null;
 private gain: GainNode | null = null;
 private output: MediaStreamAudioDestinationNode | null = null;
 private music: MediaStreamAudioSourceNode | null = null;
 private musicStream: MediaStream | null = null;
 enabled = false;
 get stream(): MediaStream | null { return this.output?.stream ?? null; }
 async enable(): Promise<void> {
  if (!this.context) {
   this.context = new AudioContext(); this.output=this.context.createMediaStreamDestination();
   this.oscillator=this.context.createOscillator(); this.oscillator.type='sine'; this.gain=this.context.createGain(); this.gain.gain.value=0;
   this.oscillator.connect(this.gain); this.gain.connect(this.context.destination); this.gain.connect(this.output); this.oscillator.start();
  }
  await this.context.resume(); this.enabled=true;
 }
 disable(): void { this.enabled=false; if(this.context && this.gain) this.gain.gain.setTargetAtTime(0,this.context.currentTime,0.04); }
 mix(stream: MediaStream | null): void {
  if(!this.context || !this.output || stream===this.musicStream) return;
  this.music?.disconnect(); this.music=null; this.musicStream=stream;
  if(stream) { this.music=this.context.createMediaStreamSource(stream); this.music.connect(this.output); }
 }
 update(state: PoseState): void {
  if(!this.context || !this.gain || !this.oscillator) return;
  const velocity = Array.from(state.velocities);
  const movement = velocity.length ? velocity.reduce((sum, v) => sum + Math.abs(v), 0) / velocity.length : 0;
  const energy=state.hasDetection && this.enabled ? Math.min(1,movement*4):0;
  const hand=state.landmarks[16];
  this.gain.gain.setTargetAtTime(energy*0.18,this.context.currentTime,0.06);
  this.oscillator.frequency.setTargetAtTime(130+(1-(hand?.y ?? 0.5))*650,this.context.currentTime,0.08);
 }
}
