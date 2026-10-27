import { runtimeMessageSchema, type RuntimeStatus } from "./protocol";

export class RuntimeCallError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Pending = { resolve: (data: unknown) => void; reject: (error: RuntimeCallError) => void };

export class RuntimeClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Set<(status: RuntimeStatus) => void>();
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
      for (const listener of this.listeners) listener(message.status);
      return;
    }
    const waiting = this.pending.get(message.id);
    if (!waiting) return;
    this.pending.delete(message.id);
    if (message.outcome.ok) waiting.resolve(message.outcome.data);
    else waiting.reject(new RuntimeCallError(message.outcome.code));
  }

  onStatus(listener: (status: RuntimeStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
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
