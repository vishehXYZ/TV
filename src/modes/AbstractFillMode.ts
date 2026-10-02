import type { PoseTracker } from '../tracking/PoseTracker';
import { SegmentationMaskTexture } from '../tracking/SegmentationMaskTexture';
import { AbstractFieldMode } from './AbstractFieldMode';

/** Mode "Abstract Fill" — the painterly noise field clipped to your body silhouette, like Fill mode's girih pattern. */
export class AbstractFillMode extends AbstractFieldMode {
  private maskTexture = new SegmentationMaskTexture();

  protected applyReveal(poseTracker: PoseTracker): void {
    this.material.setUseReveal(false);
    const texture = this.maskTexture.update(poseTracker.state);
    this.material.setMask(texture, this.maskTexture.width, this.maskTexture.height);
  }

  override dispose(): void {
    super.dispose();
    this.maskTexture.dispose();
  }
}
