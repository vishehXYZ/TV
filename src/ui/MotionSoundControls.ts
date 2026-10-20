import { Pane } from 'tweakpane';
import type { MotionSound } from '../tracking/MotionSound';

export class MotionSoundControls {
 readonly container = document.createElement('div');
 private pane: Pane;
 constructor(sound: MotionSound) {
  this.container.className = 'motion-sound-settings';
  this.pane = new Pane({ container: this.container, title: 'Motion sound settings' });
  const s=sound.settings;
  this.pane.addBinding(s,'voice',{ label:'Sound type', options:{ 'Original tone':'Tone', 'Glitch / static':'Glitch', 'Morse code':'Morse', 'Metallic / FM':'Metallic', 'Deep drone':'Drone' } });
  this.pane.addBinding(s,'volume',{label:'Volume',min:0,max:1,step:0.05});
  this.pane.addBinding(s,'sensitivity',{label:'Motion sensitivity',min:0.2,max:4,step:0.1});
  this.pane.addBinding(s,'pitch',{label:'Pitch',min:0.25,max:3,step:0.05});
  const rhythm=this.pane.addFolder({title:'Rhythm / texture',expanded:true});
  rhythm.addBinding(s,'rate',{label:'Speed',min:0.25,max:3,step:0.05});
  rhythm.addBinding(s,'texture',{label:'Noise / metal',min:0,max:1,step:0.05});
  rhythm.addBinding(s,'morseText',{label:'Morse text (A-Z/0-9)'});
  const delay=this.pane.addFolder({title:'Audio delay',expanded:true});
  delay.addBinding(s,'delay',{label:'Enable delay'}).on('change',()=>sound.clearDelay());
  delay.addBinding(s,'delayTime',{label:'Delay seconds',min:0.05,max:1.5,step:0.05});
  delay.addBinding(s,'feedback',{label:'Repeats',min:0,max:0.8,step:0.05});
  delay.addBinding(s,'wet',{label:'Echo volume',min:0,max:1,step:0.05});
  delay.addButton({title:'Clear audio echoes'}).on('click',()=>sound.clearDelay());
 }
}
