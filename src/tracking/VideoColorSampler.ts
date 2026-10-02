/** Draws the webcam video to a small offscreen canvas once per frame so many color samples can be read cheaply from JS without repeated GPU readbacks. */
export class VideoColorSampler {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private size = 96;

  constructor() {
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  update(video: HTMLVideoElement): void {
    if (video.readyState < 2 || video.videoWidth === 0) return;
    this.ctx.drawImage(video, 0, 0, this.size, this.size);
    this.imageData = this.ctx.getImageData(0, 0, this.size, this.size);
  }

  /** imageX/imageY are normalized 0..1 in MediaPipe image-space (not mirrored). Returns 0-255 RGB. */
  sample(imageX: number, imageY: number): [number, number, number] {
    if (!this.imageData) return [180, 180, 190];
    const x = Math.min(this.size - 1, Math.max(0, Math.floor(imageX * this.size)));
    const y = Math.min(this.size - 1, Math.max(0, Math.floor(imageY * this.size)));
    const idx = (y * this.size + x) * 4;
    const d = this.imageData.data;
    return [d[idx]!, d[idx + 1]!, d[idx + 2]!];
  }
}
