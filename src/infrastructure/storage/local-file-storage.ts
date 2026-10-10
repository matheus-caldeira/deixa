import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { FileStorage } from "@/shared/storage";

export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(rootDirectory: string) {
    this.root = resolve(rootDirectory);
  }

  private resolveInsideRoot(relativePath: string): string {
    const cleaned = normalize(relativePath);
    if (isAbsolute(cleaned) || cleaned.split(sep).includes("..")) {
      throw new Error("caminho de arquivo fora do diretório de dados");
    }
    return join(this.root, cleaned);
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    const target = this.resolveInsideRoot(relativePath);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, target);
  }

  async read(relativePath: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolveInsideRoot(relativePath));
    } catch {
      return null;
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      return (await stat(this.resolveInsideRoot(relativePath))).isFile();
    } catch {
      return false;
    }
  }
}
