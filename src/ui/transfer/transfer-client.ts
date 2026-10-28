import type { PackagePreview } from "@/modules/packages";

export const PERSONAL_EXPORT_ACTION: string | undefined = "/api/transfer/export-personal";

export function downloadPackage(params: URLSearchParams): void {
  const link = document.createElement("a");
  link.href = `/api/transfer/export?${params}`;
  link.download = "";
  link.click();
}

export async function exportPersonal(_form: HTMLFormElement): Promise<"native" | "saved" | "wrongPassword"> {
  return "native";
}

export async function inspectPackage(
  file: File,
): Promise<{ ok: true; data: PackagePreview } | { ok: false; message: string }> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/transfer/import", { method: "POST", body: form });
  return (await response.json()) as { ok: true; data: PackagePreview } | { ok: false; message: string };
}
