/** Pure audio analysis: time-domain loudness plus frequency bands measured in Hz. */
export class AudioEnvelope {
  level=0; bass=0; mid=0; treble=0; pulse=0; kick=0; triggered=false;
  private average=0;private bassAverage=0;private previous=0;private previousBass=0;
  private sinceBeat=10;private sinceKick=10;
  reset():void{this.level=this.bass=this.mid=this.treble=this.pulse=this.kick=this.average=this.bassAverage=this.previous=this.previousBass=0;this.triggered=false;this.sinceBeat=this.sinceKick=10;}
  update(wave:Float32Array,spectrum:Uint8Array,sampleRate:number,fftSize:number,dt:number,microphone=false):void{
    dt=Math.max(1/240,Math.min(.2,dt));this.sinceBeat+=dt;this.sinceKick+=dt;
    let square=0;for(const value of wave)square+=value*value;
    const rms=Math.sqrt(square/Math.max(1,wave.length));
    const loudness=Math.min(1.2,Math.sqrt(Math.max(0,rms-(microphone?.006:.0015))*4));
    const band=(low:number,high:number)=>{
      const from=Math.max(0,Math.ceil(low*fftSize/sampleRate)),to=Math.min(spectrum.length,Math.ceil(high*fftSize/sampleRate));
      let energy=0;for(let i=from;i<to;i++){const x=spectrum[i]!/255;energy+=x*x;}
      return Math.max(0,Math.sqrt(energy/Math.max(1,to-from))-.012)*2;
    };
    const low=band(40,250),middle=band(250,2000),high=band(2000,10000);
    const smooth=(value:number,target:number)=>value+(target-value)*(1-Math.exp(-dt/(target>value?.035:.16)));
    this.level=smooth(this.level,loudness);this.bass=smooth(this.bass,low);this.mid=smooth(this.mid,middle);this.treble=smooth(this.treble,high);
    this.average+=(loudness-this.average)*(1-Math.exp(-dt));this.bassAverage+=(low-this.bassAverage)*(1-Math.exp(-dt));
    this.pulse*=Math.exp(-dt*7);this.kick*=Math.exp(-dt*10);
    if(loudness>this.average*1.2+.035&&loudness>this.previous+.015&&this.sinceBeat>.14){this.pulse=1;this.triggered=true;this.sinceBeat=0;}
    if(low>this.bassAverage*1.18+.04&&low>this.previousBass+.02&&this.sinceKick>.12){this.kick=1;this.sinceKick=0;}
    this.previous=loudness;this.previousBass=low;
  }
}
