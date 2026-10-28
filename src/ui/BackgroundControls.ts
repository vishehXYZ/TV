import { HORMONES } from '../core/HormoneMolecules';
import { GENERATIVE_STYLES, TYPOGRAPHY_STYLES, GENERATIVE_PALETTES, LANGUAGE_STYLES, HORMONE_STYLES } from '../core/GenerativeBackground';
import { BackgroundLayer } from '../core/BackgroundLayer';

/** Brightness/contrast/saturation combos for the one-click filter presets — kept alongside the raw
 * sliders (clicking a preset also snaps the sliders to match) rather than as a separate hidden system. */
const FILTER_PRESETS: Record<string, { brightness: number; contrast: number; saturation: number }> = {
  Normal: { brightness: 1, contrast: 1, saturation: 1 },
  'B&W': { brightness: 1, contrast: 1.1, saturation: 0 },
  Vintage: { brightness: 1.05, contrast: 0.85, saturation: 0.6 },
  Vivid: { brightness: 1.05, contrast: 1.25, saturation: 1.5 },
  Cool: { brightness: 1, contrast: 1.1, saturation: 1.1 },
  Warm: { brightness: 1.08, contrast: 1.05, saturation: 1.15 },
};

/** Background source picker: none, Self View (live camera with adjustable opacity), or a user-uploaded image/video — available regardless of visual mode. Exposes three separate containers (source picker, backdrop dim, media edit) so each renders as its own clearly divided lane in the control bar rather than one blended group. */
export class BackgroundControls {
  readonly container: HTMLDivElement;
  readonly backdropContainer: HTMLDivElement;
  /** Brightness/contrast/saturation/speed/filter presets — only meaningful once a source (Self View,
   * Image, or Video) is active, hidden entirely on None. */
  readonly editContainer: HTMLDivElement;
  /** Exposed so a shortcut elsewhere (e.g. right under the webcam preview) can trigger the exact same
   * Self View logic — including the "enable camera first" check and opacity-row toggling — instead of
   * duplicating it. */
  readonly cameraButton: HTMLButtonElement;
  readonly noneButton: HTMLButtonElement;

  private placementSelect: HTMLSelectElement;
  private background: BackgroundLayer;
  private getCameraVideo: () => HTMLVideoElement | null;
  private buttons: HTMLButtonElement[] = [];
  private dimButtons: HTMLButtonElement[] = [];
  private filterButtons: HTMLButtonElement[] = [];

  constructor(background: BackgroundLayer, getCameraVideo: () => HTMLVideoElement | null, kind: 'Background' | 'Foreground' = 'Background') {
    this.background = background;
    this.getCameraVideo = getCameraVideo;

    this.container = document.createElement('div');
    this.container.className = 'background-controls';
    this.backdropContainer = document.createElement('div');
    this.backdropContainer.className = 'background-controls';
    this.editContainer = document.createElement('div');
    this.editContainer.className = 'background-controls';
    this.editContainer.style.display = 'none';

    const label = document.createElement('span');
    label.className = 'background-label';
    label.textContent = kind;
    this.container.appendChild(label);

    const noneBtn = this.makeButton('None', () => {
      this.background.clear();
      this.setActive(noneBtn);
      opacityRow.style.display = 'none';
      this.editContainer.style.display = 'none';
      speedRow.style.display = 'none';
    });

    const cameraBtn = this.makeButton(kind === 'Foreground' ? 'Self View' : 'Camera background', () => {
      const video = this.getCameraVideo();
      if (!video) {
        alert('Click "Enable Camera" first, then choose Self View again.');
        return;
      }
      this.background.setCamera(video);
      this.background.setOpacity(Number(opacitySlider.value) / 100);
      this.setActive(cameraBtn);
      opacityRow.style.display = 'flex';
      this.editContainer.style.display = 'flex';
      speedRow.style.display = 'none';
    });

    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';
    imageInput.addEventListener('change', () => {
      const file = imageInput.files?.[0];
      if (!file) return;
      this.background.setImage(URL.createObjectURL(file));
      this.setActive(imageBtn);
      opacityRow.style.display = 'none';
      this.editContainer.style.display = 'flex';
      speedRow.style.display = 'none';
    });
    const imageBtn = this.makeButton('Image', () => imageInput.click());

    const videoInput = document.createElement('input');
    videoInput.type = 'file';
    videoInput.accept = 'video/*';
    videoInput.style.display = 'none';
    videoInput.addEventListener('change', () => {
      const file = videoInput.files?.[0];
      if (!file) return;
      this.background.setVideo(URL.createObjectURL(file));
      this.background.setPlaybackRate(Number(speedSlider.value) / 100);
      this.setActive(videoBtn);
      opacityRow.style.display = 'none';
      this.editContainer.style.display = 'flex';
      speedRow.style.display = 'flex';
    });
    const videoBtn = this.makeButton('Video', () => videoInput.click());

    const generatorPanel = document.createElement('div');
    generatorPanel.className = 'background-controls'; generatorPanel.style.display = 'none';
    const genSelect = (label: string, values: readonly string[], key: 'style' | 'reaction' | 'palette' | 'base' | 'alphabet' | 'bodyPlacement' | 'letterMotion' | 'moleculeArrangement' | 'molecularColors' | 'molecularForm') => {
      const row = document.createElement('label'); row.className = 'opacity-row'; row.textContent = label;
      const select = document.createElement('select'); select.className = 'background-button';
      for(const value of values) {const o=document.createElement('option');o.value=value;o.textContent=value;select.append(o);}
      select.addEventListener('change',()=>{if(background.generator) background.generator.settings[key]=select.value;});
      row.append(select);generatorPanel.append(row);
      return select;
    };
    const styleSelect=genSelect('Style',GENERATIVE_STYLES,'style');
    const groups=new Map<string,HTMLOptGroupElement>();
    for(const option of Array.from(styleSelect.options)){
      const group=HORMONE_STYLES[option.value]?'Hormones':TYPOGRAPHY_STYLES.includes(option.value)?'3D Letters':'3D Sculptures';
      let optgroup=groups.get(group);if(!optgroup){optgroup=document.createElement('optgroup');optgroup.label=group;groups.set(group,optgroup);styleSelect.append(optgroup);}optgroup.append(option);
    }
    styleSelect.value=GENERATIVE_STYLES[0];
    const alphabetSelect=genSelect('Alphabet',['Mixed','Persian','Hebrew','Arabic','English','Russian'],'alphabet');
    const alphabetRow=alphabetSelect.parentElement!;
    const letterMotionSelect=genSelect('Letter movement',['Alphabet Storm','Letter Orbit','Glyph Rain','Language Constellation'],'letterMotion');
    const arrangementSelect=genSelect('Molecule layout',['Swarm','Atlas'],'moleculeArrangement');
    const moleculeColorsSelect=genSelect('Atom colors',['Elements','Palette'],'molecularColors');
    const moleculeFormSelect=genSelect('Molecule form',['Ball + Stick','Space filling'],'molecularForm');
    const formula=document.createElement('small');formula.className='molecule-formula';generatorPanel.append(formula);
    const syncAlphabetVisibility=()=>{
      const separateLanguage=Boolean(LANGUAGE_STYLES[styleSelect.value]),molecule=HORMONE_STYLES[styleSelect.value];
      alphabetRow.style.display=TYPOGRAPHY_STYLES.includes(styleSelect.value)&&!separateLanguage?'flex':'none';
      letterMotionSelect.parentElement!.style.display=separateLanguage?'flex':'none';
      for(const select of [arrangementSelect,moleculeColorsSelect,moleculeFormSelect])select.parentElement!.style.display=molecule?'flex':'none';
      formula.style.display=molecule?'block':'none';const info=HORMONES.find(item=>item.name===molecule);formula.textContent=info?`${info.name} · ${info.formula}`:'';
    };
    styleSelect.addEventListener('change',syncAlphabetVisibility);syncAlphabetVisibility();
    const reactionSelect=genSelect('React to',['Body + Sound','Automatic','Body','Sound'],'reaction');
    const paletteSelect=genSelect('Colors',Object.keys(GENERATIVE_PALETTES),'palette');
    paletteSelect.addEventListener('change',()=>{
      if(HORMONE_STYLES[styleSelect.value]){moleculeColorsSelect.value='Palette';if(background.generator)background.generator.settings.molecularColors='Palette';}
    });
    const baseSelect=genSelect('Base',['Black','White'],'base');
    const bodyPlacementSelect=genSelect('3D / Body',['Behind body','Across body','Inside 3D space'],'bodyPlacement');
    const bodyHint=document.createElement('small');bodyHint.textContent='For your camera image, enable Foreground > Self View. The camera background is removed while Generative is active. Behind body keeps shapes underneath; Across body draws shapes over the image and effects. Inside 3D space surrounds you, with geometry both behind and in front. Body depth moves your position within this space.';generatorPanel.append(bodyHint);
    const genSliders: Array<[HTMLInputElement, 'speed'|'density'|'size'|'sensitivity'|'bodyDepth']> = [];
    for(const [label,key,min,max,initial] of [['Speed','speed',0,300,100],['Density','density',25,250,100],['Size','size',40,200,100],['Reaction strength','sensitivity',0,300,100],['Body depth','bodyDepth',-300,300,0]] as const) {
      const row=document.createElement('label');row.className='opacity-row';row.textContent=label;
      const input=document.createElement('input');input.type='range';input.min=String(min);input.max=String(max);input.value=String(initial);
      const value=document.createElement('span');value.textContent=(initial/100).toFixed(2);
      input.addEventListener('input',()=>{value.textContent=(Number(input.value)/100).toFixed(2);if(background.generator)background.generator.settings[key]=Number(input.value)/100;});
      genSliders.push([input,key]);row.append(input,value);generatorPanel.append(row);
      if(key==='bodyDepth'){
        const syncDepth=()=>{row.style.display=bodyPlacementSelect.value==='Inside 3D space'?'flex':'none';};
        bodyPlacementSelect.addEventListener('change',syncDepth);syncDepth();
      }
    }
    const pauseGen=document.createElement('button');pauseGen.className='background-button';pauseGen.textContent='Pause animation';
    pauseGen.addEventListener('click',()=>{const g=background.generator;if(g){g.settings.paused=!g.settings.paused;pauseGen.textContent=g.settings.paused?'Resume animation':'Pause animation';}});generatorPanel.append(pauseGen);
    const hint=document.createElement('small');hint.textContent='Body: enable Camera. Sound: start Microphone or Music in Sound. Recorded with the full composition.';generatorPanel.append(hint);
    const genBtn=this.makeButton('Generative',()=>{
      background.setGenerative(); const s=background.generator!.settings;
      s.bodyPlacement=bodyPlacementSelect.value;s.letterMotion=letterMotionSelect.value;s.moleculeArrangement=arrangementSelect.value;s.molecularColors=moleculeColorsSelect.value;s.molecularForm=moleculeFormSelect.value;
      s.style=styleSelect.value;s.alphabet=alphabetSelect.value;s.reaction=reactionSelect.value;s.palette=paletteSelect.value;s.base=baseSelect.value;
      for(const [input,key] of genSliders)s[key]=Number(input.value)/100;
      pauseGen.textContent='Pause animation';this.setActive(genBtn);generatorPanel.style.display='flex';
      opacityRow.style.display='flex';this.editContainer.style.display='flex';speedRow.style.display='none';
    });
    this.container.addEventListener('click',()=>{generatorPanel.style.display=background.mode==='generative'?'flex':'none';});

    this.cameraButton = cameraBtn;
    this.noneButton = noneBtn;

    const opacityRow = document.createElement('div');
    opacityRow.className = 'opacity-row';
    opacityRow.style.display = 'none';
    const opacityLabel = document.createElement('label');
    opacityLabel.textContent = 'Opacity';
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.value = '100';
    opacitySlider.addEventListener('input', () => {
      this.background.setOpacity(Number(opacitySlider.value) / 100);
    });
    opacityRow.append(opacityLabel, opacitySlider);

    const sourceRow = document.createElement('div');
    sourceRow.className = 'control-row';
    sourceRow.append(noneBtn, cameraBtn, imageBtn, videoBtn, imageInput, videoInput);
    if(kind === 'Background') sourceRow.append(genBtn);
    const solidRow = document.createElement('div');
    solidRow.className = 'control-row';
    const solidLabel = document.createElement('span'); solidLabel.textContent = 'Canvas / outside glass';
    const blackButton = document.createElement('button'), whiteButton = document.createElement('button');
    for (const [button, color] of [[blackButton, 'black'], [whiteButton, 'white']] as const) {
      button.className = 'background-button'; button.textContent = color === 'black' ? 'Black' : 'White';
      button.classList.toggle('active', color === 'black');
      button.addEventListener('click', () => {
        this.background.setSolidColor(color);
        blackButton.classList.toggle('active', color === 'black');
        whiteButton.classList.toggle('active', color === 'white');
      });
    }
    this.background.onCanvasColor(color => { blackButton.classList.toggle('active', color === 'black'); whiteButton.classList.toggle('active', color === 'white'); });
    solidRow.append(solidLabel, blackButton, whiteButton);
    if(kind === 'Foreground') solidRow.style.display = 'none';
    const placementRow = document.createElement('div'); placementRow.className = 'control-row';
    const placementLabel = document.createElement('label'); placementLabel.textContent = 'Media placement';
    const placement = document.createElement('select'); placement.className = 'background-button';
    for (const value of ['Full background', 'Inside volumes'] as const) { const option = document.createElement('option'); option.value = value; option.textContent = value === 'Full background' ? (kind === 'Foreground' ? 'Full frame' : 'Full background') : 'Inside Glass + 3D layers'; placement.append(option); }
    this.placementSelect = placement;
    placement.value = background.placement;
    placement.addEventListener('change', () => { background.placement = placement.value as typeof background.placement; });
    placementRow.append(placementLabel, placement);
    const placementHint = document.createElement('small'); placementHint.textContent = 'Placement is independent for this source. Inside uses the enabled Glass volume and visible 3D layers with Image INSIDE on.';
    this.container.append(sourceRow, solidRow, placementRow, placementHint, opacityRow, generatorPanel);

    const dimLabel = document.createElement('span');
    dimLabel.className = 'background-label';
    dimLabel.textContent = 'Backdrop';

    const lightBtn = this.makeDimButton('Light', 0);
    const darkBtn = this.makeDimButton('Dark', 0.6);

    const dimRow = document.createElement('div');
    dimRow.className = 'control-row';
    dimRow.append(lightBtn, darkBtn);
    this.backdropContainer.append(dimLabel, dimRow);

    // Media edit: brightness/contrast/saturation sliders + one-click filter presets + (video only) speed.
    const editLabel = document.createElement('span');
    editLabel.className = 'background-label';
    editLabel.textContent = 'Adjust';

    const brightnessSlider = this.makeGradeSlider('Brightness', 50, 200, 100, (v) => this.background.setBrightness(v / 100));
    const contrastSlider = this.makeGradeSlider('Contrast', 50, 200, 100, (v) => this.background.setContrast(v / 100));
    const saturationSlider = this.makeGradeSlider('Saturation', 0, 200, 100, (v) => this.background.setSaturation(v / 100));

    const filterRow = document.createElement('div');
    filterRow.className = 'control-row';
    for (const name of Object.keys(FILTER_PRESETS)) {
      const preset = FILTER_PRESETS[name]!;
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.className = 'background-button';
      btn.addEventListener('click', () => {
        this.background.setBrightness(preset.brightness);
        this.background.setContrast(preset.contrast);
        this.background.setSaturation(preset.saturation);
        brightnessSlider.value = String(preset.brightness * 100);
        contrastSlider.value = String(preset.contrast * 100);
        saturationSlider.value = String(preset.saturation * 100);
        this.setActiveFilter(btn);
      });
      this.filterButtons.push(btn);
      filterRow.appendChild(btn);
    }

    const speedRow = document.createElement('div');
    speedRow.className = 'opacity-row';
    speedRow.style.display = 'none';
    const speedLabel = document.createElement('label');
    speedLabel.textContent = 'Speed';
    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.min = '25';
    speedSlider.max = '300';
    speedSlider.value = '100';
    speedSlider.addEventListener('input', () => {
      this.background.setPlaybackRate(Number(speedSlider.value) / 100);
    });
    speedRow.append(speedLabel, speedSlider);
    const addTransport = (label: string, fn: () => void) => {
      const b = document.createElement('button'); b.className = 'background-button'; b.textContent = label;
      b.addEventListener('click', fn); speedRow.append(b);
    };
    addTransport('Back 10s', () => { const v = background.videoElement; if (v) v.currentTime = Math.max(0, v.currentTime - 10); });
    addTransport('Play / Pause', () => { const v = background.videoElement; if (v) { if (v.paused) void v.play().catch(e => alert(e.message)); else v.pause(); } });
    addTransport('Forward 10s', () => { const v = background.videoElement; if (v && Number.isFinite(v.duration)) v.currentTime = Math.min(v.duration, v.currentTime + 10); });
    addTransport('Stop', () => { const v = background.videoElement; if (v) { v.pause(); v.currentTime = 0; background.resetTrim(); } });
    const start = document.createElement('input'), end = document.createElement('input');
    for (const input of [start, end]) { input.type = 'number'; input.min = '0'; input.step = '0.1'; input.style.width = '70px'; }
    start.placeholder = 'Start (s)'; end.placeholder = 'End (s)'; start.value = '0';
    speedRow.append(start, end);
    addTransport('Apply Trim', () => { try { background.setTrim(Number(start.value), Number(end.value)); } catch (e) { alert((e as Error).message); } });
    addTransport('Reset Trim', () => background.resetTrim());

    this.editContainer.append(editLabel, filterRow, speedRow);
    this.setActiveFilter(this.filterButtons[0]!);

    this.setActive(noneBtn);
    this.setActiveDim(lightBtn);
  }

  placeInsideVolumes(): void { this.background.placement = 'Inside volumes'; this.placementSelect.value = 'Inside volumes'; }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'background-button';
    btn.addEventListener('click', onClick);
    this.buttons.push(btn);
    return btn;
  }

  /** Light/Dark backdrop dimming — a separate toggle group from the source picker above, so patterns stay visible whether you're shooting against a bright or dark real-world space. */
  private makeDimButton(label: string, dimAmount: number): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'background-button';
    btn.addEventListener('click', () => {
      this.background.setDim(dimAmount);
      this.setActiveDim(btn);
    });
    this.dimButtons.push(btn);
    return btn;
  }

  /** A labeled brightness/contrast/saturation slider row — moving it manually deselects whichever
   * filter preset was active, since the sliders no longer match a named preset exactly. */
  private makeGradeSlider(label: string, min: number, max: number, defaultValue: number, onInput: (value: number) => void): HTMLInputElement {
    const row = document.createElement('div');
    row.className = 'opacity-row';
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(defaultValue);
    slider.addEventListener('input', () => {
      onInput(Number(slider.value));
      for (const b of this.filterButtons) b.classList.remove('active');
    });
    row.append(labelEl, slider);
    this.editContainer.appendChild(row);
    return slider;
  }

  private setActive(btn: HTMLButtonElement): void {
    for (const b of this.buttons) b.classList.remove('active');
    btn.classList.add('active');
  }

  private setActiveDim(btn: HTMLButtonElement): void {
    for (const b of this.dimButtons) b.classList.remove('active');
    btn.classList.add('active');
  }

  private setActiveFilter(btn: HTMLButtonElement): void {
    for (const b of this.filterButtons) b.classList.remove('active');
    btn.classList.add('active');
  }
}
