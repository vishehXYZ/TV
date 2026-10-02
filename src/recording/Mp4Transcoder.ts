import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

// import.meta.env.BASE_URL already ends in '/' and reflects vite.config.ts's `base`
// (root locally/on Vercel, '/Traceverse/' on GitHub Pages) — a hardcoded '/ffmpeg-core'
// would 404 once the app isn't served from the domain root.
const CORE_BASE_URL = `${import.meta.env.BASE_URL}ffmpeg-core`;

/** Transcodes WebM to MP4 client-side via ffmpeg.wasm — no backend required. */
export class Mp4Transcoder {
  private ffmpeg = new FFmpeg();
  private loaded = false;

  cancel(): void { this.ffmpeg.terminate(); this.ffmpeg = new FFmpeg(); this.loaded = false; }

  async webmToMp4(webmBlob: Blob, hasAudio: boolean, onProgress?: (ratio: number) => void): Promise<Blob> {
    const ffmpeg = this.ffmpeg;
    const progressHandler = ({ progress }: {progress: number}) => onProgress?.(Math.min(Math.max(progress, 0), 1));
    ffmpeg.on('progress', progressHandler);
    try {
    if (!this.loaded) {
      const coreURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      this.loaded = true;
    }

    const inputData = await fetchFile(webmBlob);
    await ffmpeg.writeFile('input.webm', inputData);
    const exitCode = await ffmpeg.exec([
      '-y',
      '-i',
      'input.webm',
      ...(webmBlob.type.includes('mp4') ? ['-c:v', 'copy'] : ['-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p']),
      // Encode real audio when the recording actually has an audio track (mic/music was active);
      // otherwise explicitly drop audio (-an) rather than asking ffmpeg to encode an AAC stream that
      // doesn't exist in the input — that mismatch is what caused the transcode to hang indefinitely
      // on canvas-only (no mic/music) recordings, the most common case.
      ...(hasAudio ? ['-c:a', 'aac'] : ['-an']),
      // Rewrites the file so the moov atom (duration/index) sits at the front instead of the end —
      // without this, mobile players and Instagram's uploader read a 0/unknown duration and reject
      // or mis-show the file, even though it's otherwise a valid MP4.
      '-movflags',
      '+faststart',
      'output.mp4',
    ]);
    if (exitCode !== 0) throw new Error('MP4 conversion failed. Try a shorter Test recording.');
    const data = await ffmpeg.readFile('output.mp4');
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.mp4');

    const bytes = data as Uint8Array;
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Blob([buffer], { type: 'video/mp4' });
    } finally { ffmpeg.off('progress', progressHandler); }
  }
}
