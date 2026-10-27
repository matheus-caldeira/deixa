import type { FileStorage } from "@/shared/storage";

type SyncHandle = {
  read(buffer: Uint8Array, options: { at: number }): number;
  write(buffer: Uint8Array, options: { at: number }): number;
  truncate(size: number): void;
  getSize(): number;
  flush(): void;
  close(): void;
};

type SyncFileHandle = FileSystemFileHandle & { createSyncAccessHandle(): Promise<SyncHandle> };

function segments(relativePath: string): string[] {
  const parts = relativePath.split("/").filter((part) => part.length > 0);
  if (parts.some((part) => part === "." || part === "..")) throw new Error("invalid storage path");
  return parts;
}

export class OpfsFileStorage implements FileStorage {
  constructor(private readonly folder: string) {}

  private async directory(parts: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let current = await navigator.storage.getDirectory();
    for (const name of [this.folder, ...parts]) {
      try {
        current = await current.getDirectoryHandle(name, { create });
      } catch {
        return null;
      }
    }
    return current;
  }

  private async file(relativePath: string, create: boolean): Promise<SyncFileHandle | null> {
    const parts = segments(relativePath);
    const name = parts.pop();
    if (!name) return null;
    const folder = await this.directory(parts, create);
    if (!folder) return null;
    try {
      return (await folder.getFileHandle(name, { create })) as SyncFileHandle;
    } catch {
      return null;
    }
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    const handle = await this.file(relativePath, true);
    if (!handle) throw new Error("storage write failed");
    const access = await handle.createSyncAccessHandle();
    try {
      access.truncate(0);
      access.write(bytes, { at: 0 });
      access.flush();
    } finally {
      access.close();
    }
  }

  async read(relativePath: string): Promise<Uint8Array | null> {
    const handle = await this.file(relativePath, false);
    if (!handle) return null;
    const access = await handle.createSyncAccessHandle();
    try {
      const bytes = new Uint8Array(access.getSize());
      access.read(bytes, { at: 0 });
      return bytes;
    } finally {
      access.close();
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    return (await this.file(relativePath, false)) !== null;
  }
}
