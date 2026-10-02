import type { PoseTracker } from '../tracking/PoseTracker';

/**
 * Camera-selection dropdown — only shown once connected and only if more than one video input
 * device is available (an external/better camera, a phone's front vs. back camera, etc.), since
 * device labels aren't readable until permission has already been granted once. Hidden entirely for
 * the common single-camera-laptop case rather than showing a useless one-item dropdown.
 */
export class CameraPicker {
  readonly container: HTMLDivElement;

  private select: HTMLSelectElement;
  private poseTracker: PoseTracker;

  constructor(poseTracker: PoseTracker) {
    this.poseTracker = poseTracker;

    this.container = document.createElement('div');
    this.container.className = 'camera-picker';
    this.container.style.display = 'none';

    this.select = document.createElement('select');
    this.select.className = 'camera-picker-select';
    this.select.addEventListener('change', () => {
      void this.poseTracker.switchCamera(this.select.value);
    });

    this.container.appendChild(this.select);
  }

  /** Call once, right after the camera first connects. */
  async refresh(): Promise<void> {
    const devices = await this.poseTracker.listVideoDevices();
    if (devices.length < 2) {
      this.container.style.display = 'none';
      return;
    }
    this.select.innerHTML = '';
    devices.forEach((d, i) => {
      const option = document.createElement('option');
      option.value = d.deviceId;
      option.textContent = d.label || `Camera ${i + 1}`;
      this.select.appendChild(option);
    });
    this.container.style.display = '';
  }
}
