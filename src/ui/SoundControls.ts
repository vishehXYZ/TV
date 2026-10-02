import { AudioReactor } from '../tracking/AudioReactor';

/** Sound-reactivity controls: enable the microphone, or upload a music file to play back and analyze — either way, blends into the same movement-energy signal every mode already reacts to, with onset "hits" punching in stronger pulses. */
export class SoundControls {
  readonly container: HTMLDivElement;

  private audioReactor: AudioReactor;
  private micBtn: HTMLButtonElement;
  private uploadBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private fileInput: HTMLInputElement;
  private transportRow: HTMLDivElement;
  private playPauseBtn: HTMLButtonElement;
  private back10Btn: HTMLButtonElement;
  private fwd10Btn: HTMLButtonElement;

  constructor(audioReactor: AudioReactor) {
    this.audioReactor = audioReactor;

    this.container = document.createElement('div');
    this.container.className = 'sound-controls';

    const label = document.createElement('span');
    label.className = 'background-label';
    label.textContent = 'Sound';

    this.micBtn = document.createElement('button');
    this.micBtn.textContent = 'Mic';
    this.micBtn.className = 'background-button';
    this.micBtn.addEventListener('click', () => this.enableMic());

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'audio/*';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) void this.loadMusic(file);
    });

    this.uploadBtn = document.createElement('button');
    this.uploadBtn.textContent = 'Music';
    this.uploadBtn.className = 'background-button';
    this.uploadBtn.addEventListener('click', () => this.fileInput.click());

    this.stopBtn = document.createElement('button');
    this.stopBtn.textContent = 'Stop';
    this.stopBtn.className = 'background-button';
    this.stopBtn.style.display = 'none';
    this.stopBtn.addEventListener('click', () => this.stop());

    const row = document.createElement('div');
    row.className = 'control-row';
    row.append(this.micBtn, this.uploadBtn, this.stopBtn, this.fileInput);

    // Play/Pause + skip back/forward — only shown for an uploaded track (mic has no timeline). Pausing
    // here just calls audioEl.pause(), the file stays loaded and ready to resume, no re-upload needed.
    this.back10Btn = document.createElement('button');
    this.back10Btn.textContent = '⏪ 10s';
    this.back10Btn.className = 'background-button';
    this.back10Btn.addEventListener('click', () => this.audioReactor.seekBy(-10));

    this.playPauseBtn = document.createElement('button');
    this.playPauseBtn.textContent = 'Pause';
    this.playPauseBtn.className = 'background-button';
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());

    this.fwd10Btn = document.createElement('button');
    this.fwd10Btn.textContent = '10s ⏩';
    this.fwd10Btn.className = 'background-button';
    this.fwd10Btn.addEventListener('click', () => this.audioReactor.seekBy(10));

    this.transportRow = document.createElement('div');
    this.transportRow.className = 'control-row';
    this.transportRow.style.display = 'none';
    this.transportRow.append(this.back10Btn, this.playPauseBtn, this.fwd10Btn);

    this.container.append(label, row, this.transportRow);
  }

  private togglePlayPause(): void {
    if (this.audioReactor.isPaused) {
      this.audioReactor.resume();
      this.playPauseBtn.textContent = 'Pause';
    } else {
      this.audioReactor.pause();
      this.playPauseBtn.textContent = 'Play';
    }
  }

  private async enableMic(): Promise<void> {
    this.setButtonsDisabled(true);
    this.micBtn.textContent = 'Requesting…';
    try {
      await this.audioReactor.start();
      this.onActive('mic');
    } catch (err) {
      this.micBtn.textContent = 'Mic';
      alert(`Couldn't access the microphone: ${(err as Error).message}`);
    } finally {
      this.setButtonsDisabled(false);
    }
  }

  private async loadMusic(file: File): Promise<void> {
    this.setButtonsDisabled(true);
    this.uploadBtn.textContent = 'Loading…';
    try {
      await this.audioReactor.loadFile(file);
      this.onActive('music', file.name);
    } catch (err) {
      this.uploadBtn.textContent = 'Music';
      alert(`Couldn't play that file: ${(err as Error).message}`);
    } finally {
      this.setButtonsDisabled(false);
      this.fileInput.value = '';
    }
  }

  private onActive(source: 'mic' | 'music', label?: string): void {
    this.micBtn.textContent = source === 'mic' ? 'Mic On' : 'Mic';
    this.uploadBtn.textContent = source === 'music' ? `Playing: ${label ?? 'Music'}` : 'Music';
    this.uploadBtn.title = source === 'music' && label ? label : '';
    this.micBtn.classList.toggle('active', source === 'mic');
    this.uploadBtn.classList.toggle('active', source === 'music');
    this.stopBtn.style.display = 'inline-block';
    this.transportRow.style.display = source === 'music' ? 'flex' : 'none';
    this.playPauseBtn.textContent = 'Pause';
  }

  private stop(): void {
    this.audioReactor.stop();
    this.micBtn.textContent = 'Mic';
    this.uploadBtn.textContent = 'Music';
    this.micBtn.classList.remove('active');
    this.uploadBtn.classList.remove('active');
    this.stopBtn.style.display = 'none';
    this.transportRow.style.display = 'none';
  }

  private setButtonsDisabled(disabled: boolean): void {
    this.micBtn.disabled = disabled;
    this.uploadBtn.disabled = disabled;
  }
}
