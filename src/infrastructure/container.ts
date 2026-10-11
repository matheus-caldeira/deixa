import { DrizzleCredentialRepository } from "@/modules/ai-credentials/infrastructure/drizzle-credential-repository";
import { AesGcmCipher } from "@/modules/ai-credentials/infrastructure/aes-gcm-cipher";
import {
  makeGetKeyStatus,
  makeRemoveApiKey,
  makeResolveApiKey,
  makeSaveApiKey,
  type ApiKeyTester,
} from "@/modules/ai-credentials";
import { makeGetSpeechAudio, makeListCachedSpeech, type TtsProvider } from "@/modules/audio";
import { DrizzleAudioAssetRepository } from "@/modules/audio/infrastructure/drizzle-audio-asset-repository";
import { PerUserGate } from "@/modules/audio/infrastructure/per-user-gate";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import {
  makeGetCatalogOverview,
  makeGetEpisodeContext,
  makeGetMediaDetail,
  makeLoadSeasonEpisodes,
  makeRefreshWork,
  makeRegisterWork,
  makeSearchWorks,
  makeStartEpisode,
  type MetadataProvider,
} from "@/modules/catalog";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { FakeMetadataProvider } from "@/modules/catalog/infrastructure/fake-metadata-provider";
import { makeAddCards, makeCountDueCards, makeGradeCard, makeListDueCards } from "@/modules/flashcards";
import { DrizzleCardRepository } from "@/modules/flashcards/infrastructure/drizzle-card-repository";
import { makeAwardXp, makeGetProfileSummary, makeGetTagline, makeSaveSnapshot } from "@/modules/gamification";
import { DrizzleGamificationRepository } from "@/modules/gamification/infrastructure/drizzle-gamification-repository";
import {
  makeGetReadingView,
  makeListPendingHighlights,
  makeMarkHighlightsCarded,
  makeSyncHighlights,
} from "@/modules/highlights";
import { DrizzleHighlightRepository } from "@/modules/highlights/infrastructure/drizzle-highlight-repository";
import {
  makeGetSessionUser,
  makeSignIn,
  makeSignOut,
  makeSignUp,
  makeUpdatePreferences,
} from "@/modules/identity";
import { AttemptThrottle } from "@/modules/identity/infrastructure/attempt-throttle";
import { randomSessionTokens, scryptPasswords } from "@/modules/identity/infrastructure/crypto";
import { DrizzleIdentityRepository } from "@/modules/identity/infrastructure/drizzle-identity-repository";
import {
  makeConfirmCardBatch,
  makeGenerateCardDrafts,
  makeGetSpeakableItemText,
  makeListCatalogSuggestions,
  makeTranslateCue,
  type LlmProvider,
} from "@/modules/learning";
import { DrizzleLearningRepository } from "@/modules/learning/infrastructure/drizzle-learning-repository";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { makeGetEpisodeScript, makeImportEpisodeSubtitles } from "@/modules/subtitles";
import { DrizzleSubtitleRepository } from "@/modules/subtitles/infrastructure/drizzle-subtitle-repository";
import { systemClock, type Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { uuidGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { getEnv, hasTmdbCredentials, type Env } from "./config/env";
import { openDatabase, type Database } from "./database/client";
import { GeminiLlmProvider, testGeminiApiKey } from "./google-ai/gemini-llm-provider";
import { KokoroTtsProvider } from "./kokoro/kokoro-tts-provider";
import { logger as defaultLogger, type Logger } from "./logger/logger";
import { LocalFileStorage } from "./storage/local-file-storage";
import { TmdbClient } from "./tmdb/client";
import { TmdbMetadataProvider } from "./tmdb/tmdb-metadata-provider";

const MAX_AUDIO_GENERATIONS_PER_USER = 2;
const MAX_LOGIN_FAILURES = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export type ContainerOptions = {
  env: Env;
  db: Database;
  logger?: Logger;
  clock?: Clock;
  storage?: FileStorage;
  metadata?: MetadataProvider;
  tts?: TtsProvider;
  llmForUser?: (userId: string) => Promise<LlmProvider>;
  testApiKey?: ApiKeyTester;
};

export function buildContainer(options: ContainerOptions) {
  const { env, db } = options;
  const log = options.logger ?? defaultLogger;
  const clock = options.clock ?? systemClock;
  const ids = uuidGenerator;
  const storage = options.storage ?? new LocalFileStorage(env.DATA_DIR);

  const identity = new DrizzleIdentityRepository(db);
  const catalog = new DrizzleCatalogRepository(db);
  const subtitles = new DrizzleSubtitleRepository(db);
  const highlights = new DrizzleHighlightRepository(db);
  const learning = new DrizzleLearningRepository(db);
  const cards = new DrizzleCardRepository(db);
  const credentials = new DrizzleCredentialRepository(db);
  const audioAssets = new DrizzleAudioAssetRepository(db);
  const gamification = new DrizzleGamificationRepository(db);

  const metadata: MetadataProvider =
    options.metadata ??
    (hasTmdbCredentials(env)
      ? new TmdbMetadataProvider(
          new TmdbClient({ readAccessToken: env.TMDB_READ_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY }),
        )
      : new FakeMetadataProvider());
  const silentTts = new SilentTtsProvider();
  const tts: TtsProvider =
    options.tts ?? (env.KOKORO_URL ? new KokoroTtsProvider(env.KOKORO_URL) : silentTts);

  const cipher = new AesGcmCipher(env.AI_CREDENTIALS_MASTER_KEY);
  const resolveApiKey = makeResolveApiKey({ credentials, cipher });
  const fakeLlm = new FakeLlmProvider();
  const resolveLlm =
    options.llmForUser ??
    (async (userId: string): Promise<LlmProvider> => {
      const apiKey = await resolveApiKey(userId);
      return apiKey ? new GeminiLlmProvider(apiKey, env.GEMINI_MODEL) : fakeLlm;
    });

  const sessionDeps = {
    users: identity,
    sessions: identity,
    preferences: identity,
    passwords: scryptPasswords,
    tokens: randomSessionTokens,
    clock,
    ids,
  };
  const catalogDeps = { catalog, progress: catalog, metadata, clock, ids };

  const getEpisodeScript = makeGetEpisodeScript({ subtitles });
  const awardXp = makeAwardXp({ xp: gamification, clock, ids });
  const addCards = makeAddCards({ cards, clock, ids });
  const listPendingHighlights = makeListPendingHighlights({ highlights });
  const markHighlightsCarded = makeMarkHighlightsCarded({ highlights });
  const highlightDeps = { highlights, loadScript: getEpisodeScript, clock, ids };
  const learningDeps = {
    learning,
    clock,
    ids,
    loadScript: getEpisodeScript,
    listPendingHighlights,
    markHighlightsCarded,
    addCards,
    awardXp,
    resolveLlm,
  };

  async function findEnglishCue(cueId: string) {
    const cue = await subtitles.findCue(cueId);
    return cue && cue.language === "en" ? cue : null;
  }

  return {
    providers: { metadata: metadata.name, tts: tts.name },
    devShortcuts: env.DEV_SHORTCUTS,
    secureSessionCookie: env.SESSION_COOKIE_SECURE,
    loginThrottle: new AttemptThrottle(MAX_LOGIN_FAILURES, LOGIN_WINDOW_MS, clock),

    signIn: makeSignIn(sessionDeps),
    signUp: makeSignUp(sessionDeps),
    signOut: makeSignOut(sessionDeps),
    getSessionUser: makeGetSessionUser(sessionDeps),
    updatePreferences: makeUpdatePreferences({ preferences: identity }),
    listPeople: () => identity.listByEmailSuffix(""),

    searchWorks: makeSearchWorks(catalogDeps),
    registerWork: makeRegisterWork(catalogDeps),
    refreshWork: makeRefreshWork(catalogDeps),
    loadSeasonEpisodes: makeLoadSeasonEpisodes(catalogDeps),
    getCatalogOverview: makeGetCatalogOverview(catalogDeps),
    getMediaDetail: makeGetMediaDetail(catalogDeps),
    getEpisodeContext: makeGetEpisodeContext(catalogDeps),
    startEpisode: makeStartEpisode(catalogDeps),
    listSeasons: (mediaId: string) => catalog.listSeasons(mediaId),
    getMediaById: (mediaId: string) => catalog.findMediaById(mediaId),

    importEpisodeSubtitles: makeImportEpisodeSubtitles({
      subtitles,
      storage,
      clock,
      ids,
      findEpisodeLocation: async (episodeId) => {
        const context = await catalog.findEpisodeContext(episodeId);
        if (!context) return null;
        return {
          episodeId,
          mediaId: context.media.id,
          mediaType: context.media.type,
          seasonNumber: context.season.seasonNumber,
        };
      },
    }),
    getEpisodeScript,

    getReadingView: makeGetReadingView(highlightDeps),
    syncHighlights: makeSyncHighlights(highlightDeps),

    generateCardDrafts: makeGenerateCardDrafts(learningDeps),
    confirmCardBatch: makeConfirmCardBatch(learningDeps),
    listCatalogSuggestions: makeListCatalogSuggestions({ learning }),
    getSpeakableItemText: makeGetSpeakableItemText({ learning }),
    translateCue: makeTranslateCue({
      resolveLlm,
      saveCueTranslation: (cueId, text) => subtitles.saveCueTranslation(cueId, text, clock.now()),
      findCueLine: async (cueId) => {
        const cue = await findEnglishCue(cueId);
        if (!cue) return null;
        const script = await getEpisodeScript(cue.episodeId);
        const line = script?.lines.find((candidate) => candidate.cueId === cueId);
        return line
          ? {
              cueId,
              text: line.text,
              translation: line.translation,
              translationSource: line.translationSource,
            }
          : null;
      },
    }),
    getCueSpeechText: async (cueId: string): Promise<string> => {
      const cue = await findEnglishCue(cueId);
      if (!cue) throw new AppError("CUE_NOT_FOUND");
      return cue.text;
    },

    listDueCards: makeListDueCards({ cards, clock }),
    countDueCards: makeCountDueCards({ cards, clock }),
    gradeCard: makeGradeCard({ cards, clock, ids, awardXp }),
    addCards,

    saveApiKey: makeSaveApiKey({
      credentials,
      cipher,
      clock,
      testApiKey: options.testApiKey ?? testGeminiApiKey,
    }),
    getKeyStatus: makeGetKeyStatus({ credentials, cipher }),
    removeApiKey: makeRemoveApiKey({ credentials }),

    getSpeechAudio: makeGetSpeechAudio({
      assets: audioAssets,
      storage,
      primary: tts,
      fallback: silentTts,
      gate: new PerUserGate(MAX_AUDIO_GENERATIONS_PER_USER),
      clock,
      ids,
      onPrimaryFailure: (reason) => log.warn("tts.primary_failed", { provider: tts.name, reason }),
    }),
    listCachedSpeech: makeListCachedSpeech({ assets: audioAssets, primary: tts }),

    getProfileSummary: makeGetProfileSummary({ xp: gamification, snapshots: gamification, clock }),
    getTagline: makeGetTagline({ snapshots: gamification }),
    saveSnapshot: makeSaveSnapshot({ snapshots: gamification, clock }),
    awardXp,
  };
}

export type Container = ReturnType<typeof buildContainer>;

const globalStore = globalThis as typeof globalThis & { __deixaContainer?: Container };

export function getContainer(): Container {
  if (!globalStore.__deixaContainer) {
    const env = getEnv();
    globalStore.__deixaContainer = buildContainer({ env, db: openDatabase(env.DATABASE_URL).db });
  }
  return globalStore.__deixaContainer;
}
