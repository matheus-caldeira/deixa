import type { LevelRatingsFile } from "@/modules/catalog";
import { runtime } from "./runtime-client";

const REVOKE_AFTER_MS = 60_000;

export function downloadLevelRatings(): void {
  void runtime()
    .call("levelRatings.export")
    .then((exported) => {
      const { filename, contents } = exported as LevelRatingsFile;
      const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    })
    .catch(() => undefined);
}
