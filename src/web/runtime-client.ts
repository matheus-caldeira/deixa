import { runtimeMessageSchema, type RuntimeError, type RuntimeStatus } from "./protocol";

export class RuntimeCallError extends Error {
  constructor(readonly error: RuntimeError) {
    super(error.code);
  }
}

type Pending = { resolve: (data: unknown) => void; reject: (error: RuntimeCallError) => void };

export class RuntimeClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private readonly statusListeners = new Set<(status: RuntimeStatus) => void>();
  private readonly changeListeners = new Set<() => void>();
  private nextId = 1;
  status: RuntimeStatus = { state: "waiting" };

  constructor() {
    this.worker = new Worker(new URL("./runtime.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event) => this.receive(event.data);
  }

  private receive(raw: unknown) {
    const parsed = runtimeMessageSchema.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.kind === "status") {
      this.status = message.status;
      for (const listener of this.statusListeners) listener(message.status);
      return;
    }
    if (message.kind === "changed") {
      for (const listener of this.changeListeners) listener();
      return;
    }
    const waiting = this.pending.get(message.id);
    if (!waiting) return;
    this.pending.delete(message.id);
    if (message.outcome.ok) waiting.resolve(message.outcome.data);
    else waiting.reject(new RuntimeCallError(message.outcome.error));
  }

  onStatus(listener: (status: RuntimeStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  notifyChange() {
    for (const listener of this.changeListeners) listener();
  }

  call(operation: string, input?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, operation, input });
    });
  }
}

let shared: RuntimeClient | null = null;

export function runtime(): RuntimeClient {
  shared ??= new RuntimeClient();
  return shared;
}
