import { unzipSync, zipSync } from "fflate";
import type { PackageArchive, PackageFile } from "../application/ports";

const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

export class FflateArchive implements PackageArchive {
  async pack(files: PackageFile[]): Promise<Uint8Array> {
    const entries: Record<string, Uint8Array> = {};
    for (const file of files) entries[file.path] = file.bytes;
    return zipSync(entries, { level: 6 });
  }

  async unpack(bytes: Uint8Array): Promise<PackageFile[]> {
    const entries = unzipSync(bytes, { filter: (file) => SAFE_PATH.test(file.name) });
    return Object.entries(entries).map(([path, content]) => ({ path, bytes: content }));
  }
}
