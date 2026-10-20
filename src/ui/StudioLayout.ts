import type { ControlPanel, ParameterSection } from './ControlPanel';

/** Desktop-style top navigation. Existing controls are moved, never recreated. */
export class StudioLayout {
  constructor(app: HTMLElement, canvas: HTMLCanvasElement, modes: HTMLElement, parameters: HTMLElement,
    settingsButton: HTMLButtonElement, presentationButton: HTMLButtonElement, camera: HTMLElement[],
    background: HTMLElement[], sound: HTMLElement, recording: HTMLElement, status: HTMLElement, panel: ControlPanel, objects: HTMLElement, foreground: HTMLElement[]) {
    app.classList.add('studio-layout', 'studio-menu-layout');
    const stage=document.createElement('main');stage.className='studio-stage';
    stage.setAttribute('aria-label','Live artwork preview');stage.append(canvas);app.prepend(stage);
    const toolbar=document.createElement('header');toolbar.className='studio-toolbar';
    const top=document.createElement('div');top.className='studio-toolbar-top';
    const brand=document.createElement('strong');brand.textContent='TRACEVERSE';
    const label=document.createElement('span');label.textContent='Live studio';
    settingsButton.textContent='Hide controls';settingsButton.setAttribute('aria-expanded','true');
    top.append(brand,label,settingsButton,presentationButton);
    const nav=document.createElement('nav');nav.className='studio-menu';nav.setAttribute('aria-label','Studio sections');nav.setAttribute('role','tablist');
    toolbar.append(top,nav);app.append(toolbar);
    const dock=document.createElement('aside');dock.className='studio-dock';dock.id='studio-controls';
    dock.setAttribute('aria-label','Selected section controls');settingsButton.setAttribute('aria-controls',dock.id);
    const heading=document.createElement('h2');heading.className='studio-panel-title';
    const hint=document.createElement('p');hint.className='studio-panel-hint';
    dock.append(heading,hint);
    const content=document.createElement('div');content.className='studio-panel-content';dock.append(content);
    app.append(dock);
    const footer=document.createElement('footer');footer.className='studio-status';footer.append(status);app.append(footer);
    const groups = [
      { title:'Modes', hint:'Choose a visual mode and its style.', nodes:[modes] },
      { title:'Settings', hint:'Palette, mode effects, glow, line thickness and motion trace.', nodes:[parameters], parameter:'settings' },
      { title:'Glass', hint:'Glass shape, position, depth and color.', nodes:[parameters], parameter:'glass' },
      { title:'3D Layers', hint:'Import, duplicate and arrange solid or glass objects.', nodes:[objects] },
      { title:'Background', hint:'Background sources, video playback and edits.', nodes:background },
      { title:'Foreground', hint:'Self View, image or video in front of the background. Placement is independent.', nodes:foreground },
      { title:'Sound', hint:'Motion voices, audio delay, music and microphone.', nodes:[sound] },
      { title:'Recording', hint:'Record your artwork or export a still.', nodes:[recording] },
      { title:'Camera', hint:'Camera, tracking and self view.', nodes:camera },
    ];
    // Keep inactive controls mounted (e.g. live camera and recording listeners).
    const parking=document.createElement('div');parking.hidden=true;app.append(parking);
    const allNodes=Array.from(new Set(groups.flatMap(group=>group.nodes)));
    const buttons:HTMLButtonElement[]=[];
    let active=0;
    const showControls=(show:boolean)=>{
      app.classList.toggle('controls-hidden',!show);settingsButton.textContent=show?'Hide controls':'Show controls';
      settingsButton.setAttribute('aria-expanded',String(show));
    };
    const select=(index:number,focus=false)=>{
      active=index;const group=groups[index]!;
      for(const node of allNodes)parking.append(node);
      content.append(...group.nodes);
      heading.textContent=group.title;hint.textContent=group.hint;
      if(group.parameter)panel.showSection(group.parameter as ParameterSection);
      buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
      content.id=`studio-panel-${index}`;content.setAttribute('role','tabpanel');content.setAttribute('aria-labelledby',`studio-menu-${index}`);
      dock.scrollTop=0;showControls(true);
      if(focus)buttons[index]!.focus();
    };
    groups.forEach((group,index)=>{
      const button=document.createElement('button');button.type='button';button.className='studio-menu-button';button.textContent=group.title;
      button.id=`studio-menu-${index}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`studio-panel-${index}`);
      button.addEventListener('click',()=>select(index));nav.append(button);buttons.push(button);
    });
    nav.addEventListener('keydown',event=>{
      let next=active;
      if(event.key==='ArrowRight')next=(active+1)%groups.length;
      else if(event.key==='ArrowLeft')next=(active+groups.length-1)%groups.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=groups.length-1;
      else return;
      event.preventDefault();select(next,true);
    });
    settingsButton.addEventListener('click',()=>showControls(app.classList.contains('controls-hidden')));
    select(0);
  }
}
