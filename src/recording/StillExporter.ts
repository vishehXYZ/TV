import type { SceneManager } from '../core/SceneManager';
import { downloadBlob } from './CanvasRecorder';

/** On-demand high-resolution single-frame PNG export, supersampled above the live canvas size. */
export class StillExporter {
  private sceneManager: SceneManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  async exportPNG(renderFrame: () => void, scale = 3): Promise<void> {
    const canvas = this.sceneManager.renderer.domElement;
    const baseWidth = canvas.clientWidth;
    const baseHeight = canvas.clientHeight;
    const targetWidth = Math.round(baseWidth * scale);
    const targetHeight = Math.round(baseHeight * scale);

    this.sceneManager.resizeForExport(targetWidth, targetHeight);
    renderFrame();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

    this.sceneManager.restoreDisplaySize();
    renderFrame();

    if (blob) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadBlob(blob, `girih-still-${timestamp}.png`);
    }
  }
}
