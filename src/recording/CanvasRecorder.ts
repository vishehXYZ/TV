import { Mp4Transcoder } from './Mp4Transcoder';
export type RecordingState = 'idle' | 'recording' | 'processing';
export interface RecordingResult { blob: Blob; filename: string; }
export class CanvasRecorder {
  state: RecordingState = 'idle';
  elapsedSeconds = 0;
  onStateChange: ((state: RecordingState) => void) | null = null;
  onProgress: ((message: string) => void) | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private started = 0;
  private videoTracks: MediaStreamTrack[] = [];
  private transcoder = new Mp4Transcoder();
  private hasAudio = false;
  private generation = 0;
  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }
  start(fps = 30, audioStream?: MediaStream | null, bitrate = 16_000_000): void {
    if (this.state !== 'idle') return;
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) throw new Error('Canvas recording is unavailable in this browser.');
    const mimeType = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    this.videoTracks = this.canvas.captureStream(fps).getVideoTracks();
    const audio = audioStream?.getAudioTracks() ?? [];
    this.hasAudio = audio.length > 0;
    try {
      this.recorder = new MediaRecorder(new MediaStream([...this.videoTracks, ...audio]), { ...(mimeType ? {mimeType} : {}), videoBitsPerSecond: bitrate });
      this.chunks = []; this.generation++;
      this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
      this.recorder.start(1000); this.started = performance.now(); this.elapsedSeconds = 0; this.setState('recording');
    } catch (e) { this.release(); throw e; }
  }
  tick(): void { if (this.state === 'recording') this.elapsedSeconds = (performance.now() - this.started) / 1000; }
  async cancel(): Promise<void> {
    this.generation++;
    if (this.state === 'recording' && this.recorder) {
      await new Promise<void>(resolve => { this.recorder!.onstop = () => resolve(); this.recorder!.stop(); });
    } else if (this.state === 'processing') this.transcoder.cancel();
    this.release(); this.chunks = []; this.setState('idle');
  }
  async stop(): Promise<RecordingResult> {
    if (this.state !== 'recording' || !this.recorder) throw new Error('Not recording');
    const generation = this.generation;
    const recorder = this.recorder;
    const raw = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(this.chunks, {type: recorder.mimeType}));
      recorder.onerror = () => reject(new Error('Recording failed'));
      recorder.stop();
    });
    this.release(); this.chunks = []; this.setState('processing');
    this.onProgress?.('Preparing MP4…');
    try {
      const blob = await this.transcoder.webmToMp4(raw, this.hasAudio, ratio => this.onProgress?.(`Preparing MP4… ${Math.round(ratio * 100)}%`));
      if (generation !== this.generation) throw new Error('Recording cancelled');
      return {blob, filename: `traceverse-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`};
    } finally { if (generation === this.generation) this.setState('idle'); }
  }
  private release(): void { this.videoTracks.forEach(t => t.stop()); this.videoTracks = []; this.recorder = null; }
  private setState(state: RecordingState): void { this.state = state; this.onStateChange?.(state); }
}
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
