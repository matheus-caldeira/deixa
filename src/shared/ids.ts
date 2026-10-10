import { randomUUID } from "node:crypto";

export interface IdGenerator {
  next(): string;
}

export const uuidGenerator: IdGenerator = { next: () => randomUUID() };

export class SequentialIds implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = "id") {}

  next(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}
