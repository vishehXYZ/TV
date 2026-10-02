export type TickFn = (dtSeconds: number, elapsedSeconds: number) => void;

/** Thin requestAnimationFrame wrapper providing delta/elapsed time. */
export class RenderLoop {
  private tickFn: TickFn;
  private running = false;
  private lastTime = 0;
  private startTime = 0;

  constructor(tickFn: TickFn) {
    this.tickFn = tickFn;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const elapsed = (now - this.startTime) / 1000;
    this.tickFn(dt, elapsed);
    requestAnimationFrame(this.frame);
  };
}
