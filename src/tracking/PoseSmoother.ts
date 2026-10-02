import { OneEuroFilter } from './OneEuroFilter';
import { PoseState, type Landmark } from './PoseState';

const VISIBILITY_FREEZE_THRESHOLD = 0.5;
const NUM_LANDMARKS = 33;

/**
 * Applies a per-landmark, per-axis One Euro filter to raw MediaPipe output
 * and derives per-joint velocity + whole-body movement energy.
 */
export class PoseSmoother {
  private filtersX: OneEuroFilter[];
  private filtersY: OneEuroFilter[];
  private filtersZ: OneEuroFilter[];
  private prevSmoothed: Landmark[] | null = null;
  private prevTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.02) {
    this.filtersX = Array.from({ length: NUM_LANDMARKS }, () => new OneEuroFilter(minCutoff, beta));
    this.filtersY = Array.from({ length: NUM_LANDMARKS }, () => new OneEuroFilter(minCutoff, beta));
    this.filtersZ = Array.from({ length: NUM_LANDMARKS }, () => new OneEuroFilter(minCutoff, beta));
  }

  /** Feeds one raw detection frame into the filters and updates `state` in place. */
  update(state: PoseState, rawLandmarks: Landmark[], timestampMs: number): void {
    const t = timestampMs / 1000;
    const smoothed: Landmark[] = new Array(rawLandmarks.length);

    for (let i = 0; i < rawLandmarks.length; i++) {
      const raw = rawLandmarks[i];
      const lowConfidence = raw.visibility < VISIBILITY_FREEZE_THRESHOLD;
      const prev = this.prevSmoothed?.[i];

      if (lowConfidence && prev) {
        smoothed[i] = prev;
        continue;
      }

      smoothed[i] = {
        x: this.filtersX[i].filter(raw.x, t),
        y: this.filtersY[i].filter(raw.y, t),
        z: this.filtersZ[i].filter(raw.z, t),
        visibility: raw.visibility,
      };
    }

    let energy = 0;
    const velocities = new Float32Array(smoothed.length);
    if (this.prevSmoothed && this.prevTime !== null) {
      const dt = Math.max(t - this.prevTime, 1e-3);
      for (let i = 0; i < smoothed.length; i++) {
        const prev = this.prevSmoothed[i];
        const cur = smoothed[i];
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        velocities[i] = speed;
        energy += speed;
      }
      energy /= smoothed.length;
    }

    state.landmarks = smoothed;
    state.velocities = velocities;
    state.energy = energy;
    state.hasDetection = true;

    this.prevSmoothed = smoothed;
    this.prevTime = t;
  }
}
