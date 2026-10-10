import type { Clock } from "@/shared/clock";

const MAX_TRACKED_KEYS = 5000;

export class AttemptThrottle {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly clock: Clock,
  ) {}

  private recent(key: string): number[] {
    const since = this.clock.now().getTime() - this.windowMs;
    return (this.failures.get(key) ?? []).filter((at) => at > since);
  }

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.maxFailures;
  }

  recordFailure(key: string): void {
    if (!this.failures.has(key) && this.failures.size >= MAX_TRACKED_KEYS) {
      const oldest = this.failures.keys().next().value;
      if (oldest !== undefined) this.failures.delete(oldest);
    }
    this.failures.set(key, [...this.recent(key), this.clock.now().getTime()]);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
