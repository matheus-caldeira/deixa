import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppError } from "@/shared/errors";
import type { SubtitleCandidate } from "../domain/ranking";
import {
  SourceQuotaExceeded,
  type SourceQuota,
  type SubtitleSourceProvider,
} from "../application/source-use-cases";

const FIXTURES: Record<string, string> = {
  "fake-en-1": "sample.en.srt",
  "fake-en-2": "sample.en.srt",
  "fake-pt-1": "sample.pt-BR.srt",
};
const DAILY_LIMIT = 10;

export const FAKE_CANDIDATES: readonly SubtitleCandidate[] = [
  {
    fileId: "fake-en-1",
    language: "en",
    release: "Sample.Show.S01E01.720p.WEB-DEMO",
    fileName: "sample.en.srt",
    downloads: 1200,
    rating: 8,
    hearingImpaired: false,
    machineTranslated: false,
    fps: 23.976,
    uploader: "demo",
  },
  {
    fileId: "fake-en-2",
    language: "en",
    release: "Sample.Show.S01E01.HDTV-OTHER",
    fileName: "sample.hi.en.srt",
    downloads: 5000,
    rating: 7,
    hearingImpaired: true,
    machineTranslated: false,
    fps: 25,
    uploader: "outra",
  },
  {
    fileId: "fake-pt-1",
    language: "pt-BR",
    release: "Sample.Show.S01E01.720p.WEB-DEMO",
    fileName: "sample.pt-BR.srt",
    downloads: 800,
    rating: 9,
    hearingImpaired: false,
    machineTranslated: false,
    fps: 23.976,
    uploader: "demo",
  },
];

export class FakeSubtitleSourceProvider implements SubtitleSourceProvider {
  readonly name = "fake" as const;
  readonly calls = { search: 0, download: 0 };
  private remaining = DAILY_LIMIT;

  async search(): Promise<SubtitleCandidate[]> {
    this.calls.search += 1;
    return [...FAKE_CANDIDATES];
  }

  async download(
    fileId: string,
  ): Promise<{ bytes: Uint8Array; fileName: string; quota: SourceQuota | null }> {
    const fileName = FIXTURES[fileId];
    if (!fileName) throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "sourceFileMissing");
    if (this.remaining <= 0) {
      throw new SourceQuotaExceeded({ remaining: 0, resetAt: null });
    }
    this.calls.download += 1;
    this.remaining -= 1;
    return {
      bytes: new Uint8Array(await readFile(join(process.cwd(), "fixtures", fileName))),
      fileName,
      quota: { remaining: this.remaining, resetAt: null },
    };
  }
}
