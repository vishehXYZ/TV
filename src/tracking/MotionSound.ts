import type { PoseState } from './PoseState';
import { morseSequence } from './MorseSequence';

/** Generated audio has its own graph, so it never feeds back into movement analysis. */
export class MotionSound {
 readonly settings = { voice: 'Tone', volume: 0.65, sensitivity: 1, pitch: 1, rate: 1, texture: 0.5,
  morseText: 'INVISIBLE VIOLENCE', delay: false, delayTime: 0.3, feedback: 0.35, wet: 0.35 };
 private context: AudioContext | null = null;
 private oscillator: OscillatorNode | null = null;
 private modulator: OscillatorNode | null = null;
 private modulation: GainNode | null = null;
 private tone: GainNode | null = null;
 private noise: GainNode | null = null;
 private gain: GainNode | null = null;
 private bus: GainNode | null = null;
 private dry: GainNode | null = null;
 private delayNode: DelayNode | null = null;
 private feedbackNode: GainNode | null = null;
 private wetNode: GainNode | null = null;
 private delayFilter: BiquadFilterNode | null = null;
 private output: MediaStreamAudioDestinationNode | null = null;
 private music: MediaStreamAudioSourceNode | null = null;
 private musicStream: MediaStream | null = null;
 private nextEvent = 0;
 private lastVoice = '';
 private lastText = '';
 private morseIndex = 0;
 private sequence = morseSequence(this.settings.morseText);
 enabled = false;
 get stream(): MediaStream | null { return this.output?.stream ?? null; }
 async enable(): Promise<void> {
  if(!this.context){
   const ctx=this.context=new AudioContext();this.output=ctx.createMediaStreamDestination();
   this.bus=ctx.createGain();this.gain=ctx.createGain();this.gain.gain.value=0;
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=6;limiter.ratio.value=12;
   this.bus.connect(this.gain);this.gain.connect(limiter);limiter.connect(ctx.destination);limiter.connect(this.output);
   this.dry=ctx.createGain();this.dry.connect(this.bus);
   this.tone=ctx.createGain();this.tone.gain.value=0;this.tone.connect(this.dry);
   this.noise=ctx.createGain();this.noise.gain.value=0;this.noise.connect(this.dry);
   this.oscillator=ctx.createOscillator();this.oscillator.type='sine';this.oscillator.connect(this.tone);this.oscillator.start();
   this.modulator=ctx.createOscillator();this.modulation=ctx.createGain();this.modulation.gain.value=0;
   this.modulator.connect(this.modulation);this.modulation.connect(this.oscillator.frequency);this.modulator.start();
   const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
   const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
   const filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=1200;
   source.connect(filter);filter.connect(this.noise);source.start();
   this.createDelay();
  }
  await this.context.resume();this.enabled=true;this.nextEvent=0;
 }
 private createDelay(): void {
  if(!this.context||!this.bus||!this.tone||!this.noise)return;
  this.delayNode?.disconnect();this.feedbackNode?.disconnect();this.wetNode?.disconnect();this.delayFilter?.disconnect();
  // Disconnect old sends while retaining the direct path.
  this.tone.disconnect();this.noise.disconnect();this.tone.connect(this.dry!);this.noise.connect(this.dry!);
  const ctx=this.context;
  this.delayNode=ctx.createDelay(2);this.feedbackNode=ctx.createGain();this.wetNode=ctx.createGain();this.delayFilter=ctx.createBiquadFilter();
  this.delayFilter.type='lowpass';this.delayFilter.frequency.value=4500;
  this.tone.connect(this.delayNode);this.noise.connect(this.delayNode);
  this.delayNode.connect(this.delayFilter);this.delayFilter.connect(this.feedbackNode);this.feedbackNode.connect(this.delayNode);
  this.delayFilter.connect(this.wetNode);this.wetNode.connect(this.bus);
  this.delayNode.delayTime.value=this.settings.delayTime;
  this.feedbackNode.gain.value=this.settings.delay?this.settings.feedback:0;
  this.wetNode.gain.value=this.settings.delay?this.settings.wet:0;
 }
 clearDelay(): void { this.createDelay(); }
 disable(): void {
  this.enabled=false;
  if(this.context&&this.gain){const t=this.context.currentTime;this.gain.gain.cancelScheduledValues(t);this.gain.gain.setTargetAtTime(0,t,0.02);}
  this.silenceVoices();this.clearDelay();
 }
 private silenceVoices(): void {
  if(!this.context)return;const t=this.context.currentTime;
  for(const node of [this.tone,this.noise])if(node){node.gain.cancelScheduledValues(t);node.gain.setValueAtTime(0,t);}
 }
 mix(stream: MediaStream | null): void {
  if(!this.context||!this.output||stream===this.musicStream)return;
  this.music?.disconnect();this.music=null;this.musicStream=stream;
  if(stream){this.music=this.context.createMediaStreamSource(stream);this.music.connect(this.output);}
 }
 update(state: PoseState): void {
  if(!this.context||!this.oscillator||!this.modulator||!this.modulation||!this.gain||!this.tone||!this.noise)return;
  const ctx=this.context,t=ctx.currentTime,s=this.settings;
  let movement=0;for(const v of state.velocities)movement+=Math.abs(v);
  movement=state.velocities.length?movement/state.velocities.length:0;
  const energy=state.hasDetection&&this.enabled?Math.min(1,movement*4*s.sensitivity):0;
  const hand=state.landmarks[16];const height=hand&&hand.visibility>0.4?Math.min(1,Math.max(0,1-hand.y)):0.5;
  const frequency=(130+height*650)*s.pitch;
  if(s.voice!==this.lastVoice||s.morseText!==this.lastText){
   this.silenceVoices();this.clearDelay();this.nextEvent=t;this.morseIndex=0;
   this.sequence=morseSequence(s.morseText);this.lastVoice=s.voice;this.lastText=s.morseText;
   this.oscillator.type=s.voice==='Glitch'?'square':s.voice==='Drone'?'triangle':'sine';
  }
  this.gain.gain.setTargetAtTime(this.enabled?s.volume*0.24:0,t,0.03);
  this.delayNode!.delayTime.setTargetAtTime(Math.max(0.05,s.delayTime),t,0.06);
  this.feedbackNode!.gain.setTargetAtTime(s.delay?s.feedback:0,t,0.04);
  this.wetNode!.gain.setTargetAtTime(s.delay?s.wet:0,t,0.04);
  const metallic=s.voice==='Metallic',drone=s.voice==='Drone';
  this.modulator.frequency.setTargetAtTime(frequency*(metallic?1.414:0.5),t,0.05);
  this.modulation.gain.setTargetAtTime(metallic?frequency*(0.4+s.texture*3):drone?frequency*s.texture*0.2:0,t,0.05);
  if(s.voice==='Tone'||metallic||drone){
   this.oscillator.frequency.setTargetAtTime(drone?frequency*0.35:frequency,t,0.08);
   this.tone.gain.setTargetAtTime(energy,t,drone?0.2:0.06);return;
  }
  if(energy<0.025){this.silenceVoices();this.nextEvent=t;return;}
  if(t<this.nextEvent)return;
  const unit=0.12/Math.max(0.25,s.rate);
  if(s.voice==='Morse'){
   const step=this.sequence[this.morseIndex]!;this.morseIndex=(this.morseIndex+1)%this.sequence.length;
   this.oscillator.frequency.setTargetAtTime(frequency,t,0.005);
   const duration=unit*step.units;
   this.tone.gain.cancelScheduledValues(t);this.tone.gain.setValueAtTime(0,t);
   if(step.on){this.tone.gain.linearRampToValueAtTime(energy,t+0.004);this.tone.gain.setValueAtTime(energy,t+Math.max(0.005,duration-0.008));this.tone.gain.linearRampToValueAtTime(0,t+duration);}
   this.nextEvent=t+duration+(this.morseIndex===0?unit*7:0);
  }else{
   const duration=(0.015+Math.random()*0.06)/s.rate;
   this.oscillator.frequency.setValueAtTime(frequency*(0.25+Math.floor(Math.random()*8)/2),t);
   for(const [node,level] of [[this.tone,energy*(1-s.texture*0.6)],[this.noise,energy*s.texture*0.75]] as const){
    node.gain.cancelScheduledValues(t);node.gain.setValueAtTime(0,t);node.gain.linearRampToValueAtTime(level,t+0.003);node.gain.exponentialRampToValueAtTime(0.0001,t+duration);node.gain.setValueAtTime(0,t+duration+0.003);
   }
   this.nextEvent=t+(0.07+Math.random()*0.12)/(s.rate*(0.5+energy));
  }
 }
}
