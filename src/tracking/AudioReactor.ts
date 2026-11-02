import { AudioEnvelope } from './AudioEnvelope';

/** Local microphone/music analysis. Visual reaction gain never changes playback/recording volume. */
export class AudioReactor {
  private audioContext:AudioContext|null=null;
  private analyser:AnalyserNode|null=null;
  private dataArray:Uint8Array<ArrayBuffer>|null=null;
  private wave:Float32Array<ArrayBuffer>|null=null;
  private micStream:MediaStream|null=null;
  private audioEl:HTMLAudioElement|null=null;
  private sourceNode:AudioNode|null=null;
  private destinationNode:MediaStreamAudioDestinationNode|null=null;
  private silentSink:GainNode|null=null;
  private lastUpdateAt:number|null=null;
  private readonly envelope=new AudioEnvelope();
  sensitivity=1.4;
  reactionEnabled=true;
  get isActive():boolean{return this.analyser!==null;}
  get source():'mic'|'music'|'none'{return !this.isActive?'none':this.audioEl?'music':'mic';}
  private get signalReady():boolean{return this.isActive&&this.audioContext?.state==='running'&&!this.audioEl?.paused&&!this.audioEl?.ended;}
  get audioStream():MediaStream|null{return this.destinationNode?.stream??null;}
  get level():number{if(!this.signalReady)return 0;return Math.min(1.5,Math.max(this.envelope.level,this.envelope.pulse*.7)*this.sensitivity);}
  /** Motion-energy scale is smaller than the normalized audio meter, avoiding permanently saturated modes. */
  get motionEnergy():number{if(!this.signalReady||!this.reactionEnabled)return 0;return Math.min(.6,(this.envelope.level*.1+this.envelope.pulse*.14+this.envelope.kick*.1)*this.sensitivity);}
  get bass():number{return this.signalReady?this.envelope.bass*this.sensitivity:0;}
  get mid():number{return this.signalReady?this.envelope.mid*this.sensitivity:0;}
  get treble():number{return this.signalReady?this.envelope.treble*this.sensitivity:0;}
  get kick():number{return this.signalReady?this.envelope.kick*this.sensitivity:0;}
  consumeTrigger():boolean{const value=this.envelope.triggered;this.envelope.triggered=false;return value;}
  get hasTrack():boolean{return this.audioEl!==null;}
  get isPaused():boolean{return this.audioEl?.paused??false;}
  get currentTime():number{return this.audioEl?.currentTime??0;}
  get duration():number{return this.audioEl?.duration??0;}
  get contextState():AudioContextState|'none'{return this.audioContext?.state??'none';}
  pause():void{this.audioEl?.pause();this.envelope.reset();}
  resume():void{void this.audioContext?.resume();void this.audioEl?.play();}
  seekBy(seconds:number):void{const el=this.audioEl;if(el&&Number.isFinite(el.duration)){el.currentTime=Math.max(0,Math.min(el.duration,el.currentTime+seconds));this.envelope.reset();}}
  async start():Promise<void>{
    this.teardownSource();if(!this.audioContext)this.audioContext=new AudioContext();
    this.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    this.attachSource(this.audioContext.createMediaStreamSource(this.micStream));await this.audioContext.resume();
  }
  async loadFile(file:File):Promise<void>{
    this.teardownSource();if(!this.audioContext)this.audioContext=new AudioContext();
    const el=new Audio();el.src=URL.createObjectURL(file);el.loop=true;this.audioEl=el;
    const source=this.audioContext.createMediaElementSource(el);this.attachSource(source);source.connect(this.audioContext.destination);
    await this.audioContext.resume();await el.play();
  }
  stop():void{this.teardownSource();void this.audioContext?.close();this.audioContext=null;}
  update():void{
    if(!this.analyser||!this.dataArray||!this.wave||!this.audioContext)return;
    if(this.audioContext.state!=='running'||this.audioEl?.paused||this.audioEl?.ended){this.envelope.reset();this.lastUpdateAt=null;return;}
    const now=performance.now()/1000,dt=this.lastUpdateAt===null?1/60:now-this.lastUpdateAt;this.lastUpdateAt=now;
    this.analyser.getByteFrequencyData(this.dataArray);this.analyser.getFloatTimeDomainData(this.wave);
    this.envelope.update(this.wave,this.dataArray,this.audioContext.sampleRate,this.analyser.fftSize,dt,this.source==='mic');
  }
  private attachSource(source:AudioNode):void{
    const ctx=this.audioContext!;this.analyser=ctx.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.2;
    source.connect(this.analyser);
    this.silentSink=ctx.createGain();this.silentSink.gain.value=0;this.analyser.connect(this.silentSink);this.silentSink.connect(ctx.destination);
    this.destinationNode=ctx.createMediaStreamDestination();source.connect(this.destinationNode);this.sourceNode=source;
    this.dataArray=new Uint8Array(this.analyser.frequencyBinCount);this.wave=new Float32Array(this.analyser.fftSize);
  }
  private teardownSource():void{
    for(const track of this.micStream?.getTracks()??[])track.stop();this.micStream=null;
    if(this.audioEl){this.audioEl.pause();URL.revokeObjectURL(this.audioEl.src);this.audioEl.src='';this.audioEl=null;}
    this.sourceNode?.disconnect();this.silentSink?.disconnect();this.analyser?.disconnect();
    this.sourceNode=null;this.silentSink=null;this.destinationNode=null;this.analyser=null;this.dataArray=null;this.wave=null;
    this.envelope.reset();this.lastUpdateAt=null;
  }
}
