import type { ConcurrencyGate } from "../application/ports";

export class PerUserGate implements ConcurrencyGate {
  private readonly active = new Map<string, number>();

  constructor(private readonly limit: number) {}

  tryEnter(userId: string): boolean {
    const current = this.active.get(userId) ?? 0;
    if (current >= this.limit) return false;
    this.active.set(userId, current + 1);
    return true;
  }

  leave(userId: string): void {
    const current = this.active.get(userId) ?? 0;
    if (current <= 1) this.active.delete(userId);
    else this.active.set(userId, current - 1);
  }
}
