import type { Upload } from "@/operations/operation";

export async function uploadFromForm(entry: FormDataEntryValue | null): Promise<Upload | undefined> {
  if (!(entry instanceof File) || entry.size === 0) return undefined;
  return { filename: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) };
}
