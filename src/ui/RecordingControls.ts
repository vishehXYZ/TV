import { CanvasRecorder, downloadBlob } from '../recording/CanvasRecorder';
import { StillExporter } from '../recording/StillExporter';
import type { AudioReactor } from '../tracking/AudioReactor';
import type { SceneManager } from '../core/SceneManager';

/** Selectable recorded output resolutions. Picking one also immediately reshapes the live preview
 * itself (letterboxed to that aspect via SceneManager.setFormat) — so what you see on screen while
 * framing a shot is actually vertical/square/horizontal, not a landscape-shaped preview that then
 * gets silently squashed/stretched into a differently-shaped recorded file. */
type RecordFormat = 'horizontal' | 'vertical' | 'square';
const RECORD_FORMATS: Record<RecordFormat, { width: number; height: number; label: string }> = {
  horizontal: { width: 1920, height: 1080, label: 'Horizontal' },
  vertical: { width: 1080, height: 1920, label: 'Vertical' },
  square: { width: 2000, height: 2000, label: 'Square' },
};

/** Record/stop + hi-res PNG export controls, rendered as a small floating widget. */
export class RecordingControls {
  readonly container: HTMLDivElement;
  readonly recorder: CanvasRecorder;

  private recordButton: HTMLButtonElement;
  private timerEl: HTMLSpanElement;
  private progressEl: HTMLDivElement;
  private stillExporter: StillExporter;
  private renderFrame: () => void;

  private sceneManager: SceneManager;
  private rafHandle: number | null = null;
  private getAudioStream: () => MediaStream | null;
  private quality: 'test' | 'final' = 'final';
  private selectedFormat: RecordFormat = 'horizontal';
  private formatButtons: HTMLButtonElement[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    stillExporter: StillExporter,
    renderFrame: () => void,
    audioReactor: AudioReactor,
    sceneManager: SceneManager,
    getAudioStream: () => MediaStream | null = () => audioReactor.audioStream,
  ) {
    this.getAudioStream = getAudioStream;
    this.recorder = new CanvasRecorder(canvas);
    this.stillExporter = stillExporter;
    this.renderFrame = renderFrame;

    this.sceneManager = sceneManager;

    this.container = document.createElement('div');
    this.container.className = 'recording-controls';

    const label = document.createElement('span');
    label.className = 'background-label';
    label.textContent = 'Record';
    this.container.appendChild(label);

    this.recordButton = document.createElement('button');
    this.recordButton.className = 'record-button';
    this.recordButton.title = 'Start recording';
    this.recordButton.innerHTML = '<span class="record-dot"></span>';
    this.recordButton.addEventListener('click', () => this.toggleRecording());

    this.timerEl = document.createElement('span');
    this.timerEl.className = 'record-timer';

    const pngButton = document.createElement('button');
    pngButton.className = 'png-button';
    pngButton.textContent = 'PNG';
    pngButton.addEventListener('click', () => void this.exportPng());

    this.progressEl = document.createElement('div');
    this.progressEl.className = 'record-progress';

    const row = document.createElement('div');
    row.className = 'control-row';
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel Recording'; cancel.hidden = true;
    cancel.addEventListener('click', () => { void this.recorder.cancel().finally(() => { if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle); this.sceneManager.restoreDisplaySize(); this.renderFrame(); }); });
    const quality = document.createElement('select');
    quality.innerHTML = '<option value="final">Final — full size</option><option value="test">Test — half size</option>';
    quality.addEventListener('change', () => { this.quality = quality.value as 'test' | 'final'; });
    row.append(this.recordButton, this.timerEl, pngButton, cancel, quality);

    // Which output shape to record at — Horizontal/Vertical/Square — reusing the same style-pill
    // look as the mode-style rows so it reads as one consistent app UI language.
    const formatRow = document.createElement('div');
    formatRow.className = 'control-row';
    (Object.keys(RECORD_FORMATS) as RecordFormat[]).forEach((format) => {
      const btn = document.createElement('button');
      btn.className = 'style-pill';
      btn.textContent = RECORD_FORMATS[format].label;
      if (format === this.selectedFormat) btn.classList.add('active');
      btn.addEventListener('click', () => {
        this.selectedFormat = format;
        this.formatButtons.forEach((b) => b.classList.toggle('active', b === btn));
        const { width, height } = RECORD_FORMATS[format];
        this.sceneManager.setFormat(width, height);
        this.renderFrame();
      });
      this.formatButtons.push(btn);
      formatRow.appendChild(btn);
    });

    this.container.append(row, formatRow, this.progressEl);

    // Establish the letterboxed preview for the default selection immediately, rather than only
    // reshaping once the user first clicks a format pill.
    const initial = RECORD_FORMATS[this.selectedFormat];
    this.sceneManager.setFormat(initial.width, initial.height);

    this.recorder.onStateChange = (state) => {
      cancel.hidden = state === 'idle'; quality.disabled = state !== 'idle';
      this.recordButton.classList.toggle('recording', state === 'recording');
      this.recordButton.classList.toggle('processing', state === 'processing');
      this.recordButton.disabled = state === 'processing';
      this.recordButton.title = state === 'recording' ? 'Stop recording' : 'Start recording';
      // PNG export does its own temporary resize-then-restore-to-live-size — mid-recording, that would
      // reset the canvas to the wrong size for the rest of the take (recording wants a fixed 1920x1080
      // for its whole duration). Simplest correct fix: just don't allow the two to overlap.
      pngButton.disabled = state !== 'idle';
      pngButton.title = state !== 'idle' ? 'Not available while recording' : '';
      // Switching output shape mid-take would fight the recording's own fixed resolution — same
      // don't-let-them-overlap rule as the PNG button above.
      this.formatButtons.forEach((b) => (b.disabled = state !== 'idle'));
      if (state === 'idle') this.timerEl.textContent = '';
      if (state !== 'processing') this.progressEl.textContent = '';
    };
    this.recorder.onProgress = (msg) => {
      this.progressEl.textContent = msg;
    };
  }

  private toggleRecording(): void {
    if (this.recorder.state === 'idle') {
      // The on-screen CSS box is already letterboxed to the selected format's exact aspect ratio
      // (applied the moment that format pill was clicked, or on load for the default) — this just
      // bumps the internal drawing-buffer resolution up to the real target pixel dimensions and locks
      // pixelRatio to 1, so the exported file is a clean, predictable size regardless of the actual
      // window/DPI, without changing the box's shape and therefore without any stretch.
      const { width, height } = RECORD_FORMATS[this.selectedFormat];
      const scale = this.quality === 'test' ? 0.5 : 1;
      this.sceneManager.resizeForExport(width * scale, height * scale);
      this.renderFrame();
      // Mic or uploaded music, whichever is currently active, gets merged into the recording — silent
      // canvas-only capture otherwise, same as before.
      try { this.recorder.start(this.quality === 'test' ? 24 : 30, this.getAudioStream(), this.quality === 'test' ? 2_000_000 : 16_000_000); }
      catch (e) { this.sceneManager.restoreDisplaySize(); alert((e as Error).message); return; }
      this.tickTimer();
    } else if (this.recorder.state === 'recording') {
      if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
      this.recorder
        .stop()
        .then(({ blob, filename }) => downloadBlob(blob, filename))
        .catch((err) => { if ((err as Error).message !== "Recording cancelled") alert((err as Error).message); })
        .finally(() => {
          this.sceneManager.restoreDisplaySize();
          this.renderFrame();
        });
    }
  }

  private tickTimer = (): void => {
    this.recorder.tick();
    if (this.recorder.state !== 'recording') return;
    const s = this.recorder.elapsedSeconds;
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, '0');
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, '0');
    this.timerEl.textContent = `${mm}:${ss}`;
    this.rafHandle = requestAnimationFrame(this.tickTimer);
  };

  private async exportPng(): Promise<void> {
    await this.stillExporter.exportPNG(this.renderFrame, 3);
  }
}
