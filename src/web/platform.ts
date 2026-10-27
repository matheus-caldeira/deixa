import type { Platform } from "@/infrastructure/platform";
import { PortableGcmCipher } from "@/modules/ai-credentials/infrastructure/portable-gcm-cipher";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import { FetchLevelSourceFetcher } from "@/modules/catalog/infrastructure/fetch-level-source-fetcher";
import { portablePasswords, portableSessionTokens } from "@/modules/identity/infrastructure/portable-crypto";
import { PortablePersonalCipher } from "@/modules/packages/infrastructure/portable-personal-cipher";
import type { SubtitleSourceProvider } from "@/modules/subtitle-sources";
import { AppError } from "@/shared/errors";
import { OpfsFileStorage } from "./opfs-storage";

const DATA_FOLDER = "data";

const noSubtitleSource: SubtitleSourceProvider = {
  name: "fake",
  search: async () => [],
  download: async () => {
    throw new AppError("SUBTITLE_SOURCE_UNAVAILABLE", "sourceFileMissing");
  },
};

export const browserPlatform: Platform = {
  storage: () => new OpfsFileStorage(DATA_FOLDER),
  passwords: portablePasswords,
  tokens: portableSessionTokens,
  cipher: (masterKey) => new PortableGcmCipher(masterKey),
  personalCipher: new PortablePersonalCipher(),
  levelSourceFetcher: () => new FetchLevelSourceFetcher(),
  tts: () => new SilentTtsProvider(),
  fakeSubtitleSource: () => noSubtitleSource,
};
