export interface GameLoopOptions {
  readonly fixedStepSeconds: number;
  readonly maxCatchUpSteps: number;
  readonly maxDeltaSeconds: number;
  readonly onFixedUpdate: (deltaSeconds: number) => void;
  readonly onRender: (alpha: number) => void;
}

/** Fixed-step simulation with an interpolated render pass. */
export class GameLoop {
  private animationFrameId: number | undefined;
  private previousTimeMs: number | undefined;
  private accumulatorSeconds = 0;
  private running = false;

  constructor(private readonly options: GameLoopOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTimeMs = undefined;
    this.animationFrameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId !== undefined)
      cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = undefined;
    this.resetTime();
  }

  resetTime(): void {
    this.previousTimeMs = undefined;
    this.accumulatorSeconds = 0;
  }

  private readonly frame = (timeMs: number): void => {
    if (!this.running) return;
    if (this.previousTimeMs === undefined) this.previousTimeMs = timeMs;
    const elapsedSeconds = Math.min(
      Math.max(0, (timeMs - this.previousTimeMs) / 1000),
      this.options.maxDeltaSeconds,
    );
    this.previousTimeMs = timeMs;
    this.accumulatorSeconds += elapsedSeconds;
    let steps = 0;
    while (
      this.accumulatorSeconds >= this.options.fixedStepSeconds &&
      steps < this.options.maxCatchUpSteps
    ) {
      this.options.onFixedUpdate(this.options.fixedStepSeconds);
      this.accumulatorSeconds -= this.options.fixedStepSeconds;
      steps += 1;
    }
    if (steps === this.options.maxCatchUpSteps) this.accumulatorSeconds = 0;
    this.options.onRender(
      this.accumulatorSeconds / this.options.fixedStepSeconds,
    );
    this.animationFrameId = requestAnimationFrame(this.frame);
  };
}
