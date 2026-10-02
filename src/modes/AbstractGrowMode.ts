import type { PoseTracker } from '../tracking/PoseTracker';
import { PaintTrail } from '../generators/abstract/PaintTrail';
import { AbstractFieldMode } from './AbstractFieldMode';

/** Mode "Abstract Grow" — the painterly noise field is only revealed where you've recently moved, a continuous soft paint trail spreading and fading like wet paint tracking your motion. */
export class AbstractGrowMode extends AbstractFieldMode {
  private paintTrail = new PaintTrail();

  protected applyReveal(poseTracker: PoseTracker, dt: number): void {
    this.material.setUseReveal(true);
    this.material.setMask(null, 1, 1);

    this.paintTrail.update(poseTracker, this.sceneManager, dt);
    this.material.setTrail(this.paintTrail.getTexture());
  }

  override dispose(): void {
    super.dispose();
    this.paintTrail.dispose();
  }
}
