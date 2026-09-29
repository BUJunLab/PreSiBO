export interface SmokeStepRecord {
  name: string;
  elapsedMs: number;
}

export class SmokeStepTracker {
  private startedAt = performance.now();

  readonly records: SmokeStepRecord[] = [];

  step(name: string) {
    const now = performance.now();
    this.records.push({
      name,
      elapsedMs: now - this.startedAt
    });
    this.startedAt = now;
  }
}
