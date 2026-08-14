import { POSE_VIEW_SETTLE_MS } from '@/constants/poseDetection';

export class PoseViewSettleGate {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private settled = false;
  private lastWidth = 0;
  private lastHeight = 0;
  private onSettled: (() => void) | null = null;

  constructor(private readonly settleMs: number = POSE_VIEW_SETTLE_MS) {}

  setOnSettled(callback: () => void): void {
    this.onSettled = callback;
  }

  /** Call whenever the camera preview dimensions change. */
  update(width: number, height: number): void {
    if (width <= 1 || height <= 1) {
      this.markUnsettled();
      this.lastWidth = width;
      this.lastHeight = height;
      return;
    }

    const changed = this.lastWidth !== width || this.lastHeight !== height;
    this.lastWidth = width;
    this.lastHeight = height;

    if (changed) {
      this.markUnsettled();
      this.scheduleSettle();
    }
  }

  isSettled(): boolean {
    return this.settled && this.lastWidth > 1 && this.lastHeight > 1;
  }

  isLandscape(): boolean {
    return this.lastWidth > this.lastHeight;
  }

  reset(): void {
    this.markUnsettled();
    this.lastWidth = 0;
    this.lastHeight = 0;
  }

  dispose(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private markUnsettled(): void {
    this.settled = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private scheduleSettle(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.settled = true;
      this.onSettled?.();
    }, this.settleMs);
  }
}
