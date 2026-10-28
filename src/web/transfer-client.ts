import type { PackagePreview } from "@/modules/packages";
import { describeError, runtimeErrorOf } from "./call";
import { runtime } from "./runtime-client";

export const PERSONAL_EXPORT_ACTION: string | undefined = undefined;

type Exported = { bytes: Uint8Array; filename: string };

function save({ bytes, filename }: Exported) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function exportInput(params: URLSearchParams) {
  const kind = params.get("kind");
  const mediaId = params.get("mediaId");
  const scope =
    kind === "season"
      ? { kind, mediaId, seasonNumber: Number(params.get("seasonNumber")) }
      : kind === "episode"
        ? { kind, mediaId, episodeId: params.get("episodeId") }
        : { kind: "work", mediaId };
  const flag = (name: string) => params.get(name) === "1";
  return { scope, options: { subtitles: flag("subtitles"), cards: flag("cards"), audio: flag("audio") } };
}

export function downloadPackage(params: URLSearchParams): void {
  void runtime()
    .call("transfer.export", exportInput(params))
    .then((exported) => save(exported as Exported))
    .catch(() => undefined);
}

export async function exportPersonal(form: HTMLFormElement): Promise<"native" | "saved" | "wrongPassword"> {
  const data = new FormData(form);
  try {
    const exported = await runtime().call("transfer.exportPersonal", {
      password: String(data.get("password") ?? ""),
      includeCredentials: data.get("includeCredentials") === "true",
    });
    save(exported as Exported);
    return "saved";
  } catch {
    return "wrongPassword";
  }
}

export async function inspectPackage(
  file: File,
): Promise<{ ok: true; data: PackagePreview } | { ok: false; message: string }> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { ok: true, data: (await runtime().call("transfer.inspect", { bytes })) as PackagePreview };
  } catch (failure) {
    return { ok: false, message: describeError(runtimeErrorOf(failure)) };
  }
}
