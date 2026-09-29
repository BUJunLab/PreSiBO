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

export async function runWithTimeout<T>(
  label: string,
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${label} exceeded timeout of ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]);
}
