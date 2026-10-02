import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { PoseSmoother } from './PoseSmoother';
import { PoseState } from './PoseState';

export type PoseQuality = 'lite' | 'full';

const MODEL_PATHS: Record<PoseQuality, string> = {
  lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
};

/**
 * Owns the webcam stream and MediaPipe PoseLandmarker. Runs its own
 * detection loop against the <video> element, decoupled from the render
 * loop — the renderer only ever reads the latest value of `state`.
 */
export class PoseTracker {
  readonly state = new PoseState();

  private video: HTMLVideoElement;
  private landmarker: PoseLandmarker | null = null;
  private smoother = new PoseSmoother();
  private running = false;
  private lastVideoTime = -1;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  async init(quality: PoseQuality = 'lite'): Promise<void> {
    // Same base-path concern as Mp4Transcoder's CORE_BASE_URL — this must respect
    // vite.config.ts's `base` or it 404s once the app isn't served from the domain root.
    const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe/wasm`);
    const options = { 
      baseOptions: {
        modelAssetPath: quality === 'lite' ? `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task` : MODEL_PATHS[quality],
        delegate: 'GPU' as const,
      },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
      outputSegmentationMasks: true,
    };
    try { this.landmarker = await PoseLandmarker.createFromOptions(fileset, options); }
    catch { this.landmarker = await PoseLandmarker.createFromOptions(fileset, {...options, baseOptions:{...options.baseOptions, delegate:'CPU'}}); }
  }

  async startWebcam(deviceId?: string): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise<void>((resolve) => {
      this.video.onloadedmetadata = () => resolve();
    });
    await this.video.play();
  }

  /** Video input devices (external cameras, phone front/back, etc.) — labels are only populated
   * after camera permission has already been granted once (a browser privacy restriction), so call
   * this after startWebcam(), not before. */
  async listVideoDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  /** Switches to a different camera without touching pose tracking state — stops the old stream's
   * tracks first so the previous camera's hardware light turns off before the new one starts. */
  async switchCamera(deviceId: string): Promise<void> {
    const oldStream = this.video.srcObject as MediaStream | null;
    await this.startWebcam(deviceId);
    for (const track of oldStream?.getTracks() ?? []) track.stop();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private loop = (): void => {
    if (!this.running) return;
    this.detectFrame();
    requestAnimationFrame(this.loop);
  };

  private detectFrame(): void {
    if (!this.landmarker) return;
    if (this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    const result: PoseLandmarkerResult = this.landmarker.detectForVideo(this.video, performance.now());
    this.consumeResult(result);
  }

  private consumeResult(result: PoseLandmarkerResult): void {
    const landmarks = result.landmarks[0];
    if (landmarks && landmarks.length > 0) {
      this.smoother.update(
        this.state,
        landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 1 })),
        performance.now(),
      );
    }

    const mask = result.segmentationMasks?.[0];
    if (mask) {
      this.state.segmentationMask = {
        data: mask.getAsFloat32Array(),
        width: mask.width,
        height: mask.height,
      };
      mask.close();
    }
  }
}
