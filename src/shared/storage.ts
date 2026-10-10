export interface FileStorage {
  write(relativePath: string, bytes: Uint8Array): Promise<void>;
  read(relativePath: string): Promise<Uint8Array | null>;
  exists(relativePath: string): Promise<boolean>;
}

export class InMemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Uint8Array>();

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    this.files.set(relativePath, bytes);
  }

  async read(relativePath: string): Promise<Uint8Array | null> {
    return this.files.get(relativePath) ?? null;
  }

  async exists(relativePath: string): Promise<boolean> {
    return this.files.has(relativePath);
  }
}
