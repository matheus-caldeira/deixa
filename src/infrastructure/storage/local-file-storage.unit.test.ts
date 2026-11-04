import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFileStorage } from "./local-file-storage";

describe("armazenamento local", () => {
  let root: string;
  let storage: LocalFileStorage;
  const bytes = new Uint8Array([1, 2, 3]);

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "deixa-storage-"));
    storage = new LocalFileStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("remove a pasta de uma conta sem tocar nas outras", async () => {
    await storage.write("packages/u-1/a.zip", bytes);
    await storage.write("packages/u-1/b.zip", bytes);
    await storage.write("packages/u-2/a.zip", bytes);
    await storage.removeDirectory("packages/u-1");
    expect(await storage.exists("packages/u-1/a.zip")).toBe(false);
    expect(await storage.exists("packages/u-1/b.zip")).toBe(false);
    expect(await storage.exists("packages/u-2/a.zip")).toBe(true);
  });

  it("aceita pasta inexistente e recusa a raiz ou caminho para fora", async () => {
    await expect(storage.removeDirectory("packages/ninguem")).resolves.toBeUndefined();
    await expect(storage.removeDirectory(".")).rejects.toThrow();
    await expect(storage.removeDirectory("../fora")).rejects.toThrow();
  });
});
