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

  private background: BackgroundLayer;
  private getCameraVideo: () => HTMLVideoElement | null;
  private buttons: HTMLButtonElement[] = [];
  private dimButtons: HTMLButtonElement[] = [];
  private filterButtons: HTMLButtonElement[] = [];

  constructor(background: BackgroundLayer, getCameraVideo: () => HTMLVideoElement | null) {
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
    label.textContent = 'Background';
    this.container.appendChild(label);

    const noneBtn = this.makeButton('None', () => {
      this.background.clear();
      this.setActive(noneBtn);
      opacityRow.style.display = 'none';
      this.editContainer.style.display = 'none';
      speedRow.style.display = 'none';
    });

    const cameraBtn = this.makeButton('Self View', () => {
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
    this.container.append(sourceRow, opacityRow);

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
