import { createHash } from "node:crypto";
import { DrizzleCredentialRepository } from "@/modules/ai-credentials/infrastructure/drizzle-credential-repository";
import { AesGcmCipher } from "@/modules/ai-credentials/infrastructure/aes-gcm-cipher";
import {
  PROVIDERS_WITH_EMBEDDINGS,
  SECRET_KINDS,
  makeGetAiModels,
  makeGetCredentialOverview,
  makeRemoveCredential,
  makeResolveCredential,
  makeSaveCredential,
  makeSetAiModels,
  parseEndpoint,
  tmdbSecretKind,
  type AiService,
  type CredentialService,
  type CredentialTester,
} from "@/modules/ai-credentials";
import { ALL_VOICES, makeGetSpeechAudio, makeListCachedSpeech, type TtsProvider } from "@/modules/audio";
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
  type MediaType,
  type MetadataProvider,
} from "@/modules/catalog";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { FakeMetadataProvider } from "@/modules/catalog/infrastructure/fake-metadata-provider";
import {
  makeAddCards,
  makeAnticipateReview,
  makeCountDueCards,
  makeGetAnticipationStatus,
  makeGradeCard,
  makeListDueCards,
} from "@/modules/flashcards";
import { DrizzleCardRepository } from "@/modules/flashcards/infrastructure/drizzle-card-repository";
import {
  makeGetConversation,
  makeGetTurnSpeechText,
  makeListConversations,
  makeReviewConversation,
  makeSendMessage,
  makeStartConversation,
  type Correction,
  type TutorProvider,
} from "@/modules/conversations";
import { DrizzleConversationRepository } from "@/modules/conversations/infrastructure/drizzle-conversation-repository";
import { FakeTutorProvider } from "@/modules/conversations/infrastructure/fake-tutor-provider";
import {
  makeAwardXp,
  makeGetProfileSummary,
  makeSaveSnapshot,
  makeSettleMissions,
} from "@/modules/gamification";
import { DrizzleGamificationRepository } from "@/modules/gamification/infrastructure/drizzle-gamification-repository";
import {
  makeGetReadingView,
  makeListPendingHighlights,
  makeMarkHighlightsCarded,
  makeSyncHighlights,
} from "@/modules/highlights";
import { DrizzleHighlightRepository } from "@/modules/highlights/infrastructure/drizzle-highlight-repository";
import {
  DEFAULT_TIMEZONE,
  makeFindOwner,
  makeGetSessionUser,
  makeSignIn,
  makeSignOut,
  makeSignUp,
  makeStartOwnerSession,
  makeUpdatePreferences,
  makeAddLanguagePair,
  makeListLanguagePairs,
  makeSwitchLanguagePair,
  pairOf,
} from "@/modules/identity";
import { DEFAULT_LOCALE, type Locale } from "@/shared/locales";
import { DEFAULT_TARGET_LANGUAGE, type LanguagePair, type StudyLanguage } from "@/shared/study-languages";
import { AttemptThrottle } from "@/modules/identity/infrastructure/attempt-throttle";
import { randomSessionTokens, scryptPasswords } from "@/modules/identity/infrastructure/crypto";
import { DrizzleIdentityRepository } from "@/modules/identity/infrastructure/drizzle-identity-repository";
import {
  makeConfirmCardBatch,
  makeGenerateCardDrafts,
  makeGetCardBatch,
  makeGetSpeakableItem,
  makeListCatalogSuggestions,
  makeProcessCardBatch,
  makeRequestCardDrafts,
  makeTranslateCue,
  type LlmProvider,
} from "@/modules/learning";
import { DrizzleLearningRepository } from "@/modules/learning/infrastructure/drizzle-learning-repository";
import { FakeLlmProvider } from "@/modules/learning/infrastructure/fake-llm-provider";
import { makeGetInbox, makeMarkNotificationsRead, makeNotify } from "@/modules/notifications";
import { DrizzleNotificationRepository } from "@/modules/notifications/infrastructure/drizzle-notification-repository";
import {
  makeCompleteLesson,
  makeEnsurePlan,
  makeGeneratePlan,
  makeGetTrail,
  makeStartLesson,
  type LessonPlanner,
  type TrailLine,
} from "@/modules/study";
import { DrizzleStudyRepository } from "@/modules/study/infrastructure/drizzle-study-repository";
import {
  makeImportFromSource,
  makeSearchSubtitles,
  type EpisodeSource,
  type SubtitleSourceProvider,
} from "@/modules/subtitle-sources";
import { DrizzleSourceRepository } from "@/modules/subtitle-sources/infrastructure/drizzle-source-repository";
import { FakeSubtitleSourceProvider } from "@/modules/subtitle-sources/infrastructure/fake-subtitle-source-provider";
import {
  makeAcceptRecommendation,
  makeDismissRecommendation,
  makeGetRecommendations,
  makeRefreshRecommendations,
  type EmbeddingProvider,
  type SuggestionWriter,
} from "@/modules/recommendations";
import { DrizzleRecommendationRepository } from "@/modules/recommendations/infrastructure/drizzle-recommendation-repository";
import { HashEmbeddingProvider } from "@/modules/recommendations/infrastructure/hash-embedding-provider";
import { makeGetSettings, makeUpdateSettings, mergeSettings, type AppSettings } from "@/modules/settings";
import { DrizzleSettingsRepository } from "@/modules/settings/infrastructure/drizzle-settings-repository";
import { DrizzleModelChoiceRepository } from "@/modules/ai-credentials/infrastructure/drizzle-model-choice-repository";
import {
  makeExportPackage,
  makeExportPersonalPackage,
  makeImportPackage,
  makeInspectPackage,
  makePeekPersonalEmail,
} from "@/modules/packages";
import { DrizzlePackageCatalog } from "@/modules/packages/infrastructure/drizzle-package-catalog";
import { DrizzlePersonalData } from "@/modules/packages/infrastructure/drizzle-personal-data";
import { FflateArchive } from "@/modules/packages/infrastructure/fflate-archive";
import { NodePersonalCipher } from "@/modules/packages/infrastructure/node-personal-cipher";
import {
  SHARED_KEY_DEFAULT_LIMIT,
  makeEnsureAiAllowed,
  makeGetAiUsageOverview,
  makeGetAiUsageSummary,
  makeRecordAiUsage,
  makeSaveModelPrice,
  makeSetAiUsageLimit,
  meterFor,
  type AiUsageMeter,
  type KeySource,
  type UsagePerson,
} from "@/modules/ai-usage";
import {
  DrizzleAiUsageRepository,
  DrizzleModelPriceRepository,
  DrizzleUsageLimitRepository,
} from "@/modules/ai-usage/infrastructure/drizzle-ai-usage-repository";
import { makeGetEpisodeScript, makeImportEpisodeSubtitles } from "@/modules/subtitles";
import { DrizzleSubtitleRepository } from "@/modules/subtitles/infrastructure/drizzle-subtitle-repository";
import { systemClock, type Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { uuidGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { tokenize } from "@/shared/text";
import { getEnv, hasTmdbCredentials, type Env } from "./config/env";
import { loadMasterKey } from "./config/master-key";
import { testServiceCredential } from "./credential-tester";
import { sql } from "drizzle-orm";
import { configDirectory, readStoredDatabaseUrl } from "./config/local-config";
import { openDatabase, type Database, type DatabaseHandle } from "./database/client";
import { AiEmbeddingProvider } from "./ai/ai-embedding-provider";
import { AiLessonPlanner } from "./ai/ai-lesson-planner";
import { AiLlmProvider } from "./ai/ai-llm-provider";
import { AiSuggestionWriter } from "./ai/ai-suggestion-writer";
import { AiTutorProvider } from "./ai/ai-tutor-provider";
import type { AiAccess } from "./ai/models";
import { KokoroTtsProvider } from "./kokoro/kokoro-tts-provider";
import { logger as defaultLogger, type Logger } from "./logger/logger";
import { LocalFileStorage } from "./storage/local-file-storage";
import { OpenSubtitlesProvider } from "./opensubtitles/opensubtitles-provider";
import { TmdbClient } from "./tmdb/client";
import { tmdbNumericId } from "./tmdb/mapping";
import { TmdbMetadataProvider } from "./tmdb/tmdb-metadata-provider";

const MAX_AUDIO_GENERATIONS_PER_USER = 2;
const MAX_LOGIN_FAILURES = 8;
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const FINGERPRINT_CHARS = 16;
const UNLIMITED_DOWNLOADS = Number.MAX_SAFE_INTEGER;

const fingerprint = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex").slice(0, FINGERPRINT_CHARS);

export type ContainerOptions = {
  env: Env;
  db: Database;
  logger?: Logger;
  clock?: Clock;
  storage?: FileStorage;
  metadata?: MetadataProvider;
  subtitleSource?: SubtitleSourceProvider;
  tts?: TtsProvider;
  llmForUser?: (userId: string) => Promise<LlmProvider>;
  plannerForUser?: (userId: string) => Promise<LessonPlanner | null>;
  tutorForUser?: (userId: string) => Promise<TutorProvider>;
  embeddingForUser?: (userId: string) => Promise<EmbeddingProvider>;
  suggestionWriterForUser?: (userId: string) => Promise<SuggestionWriter | null>;
  testCredential?: CredentialTester;
  masterKey?: string;
  settings?: AppSettings;
};

export function settingsFromEnvironment(env: Env): AppSettings {
  return {
    aiGeneration: { provider: "gemini", model: env.GEMINI_MODEL },
    aiEmbedding: { provider: "gemini", model: DEFAULT_EMBEDDING_MODEL },
    aiCustomEndpointsAllowed: true,
    subtitleDownloadsPerUserPerDay: env.SUBTITLE_DOWNLOADS_PER_USER_PER_DAY,
    kokoroUrl: env.KOKORO_URL ?? null,
    aiSharedLimit: SHARED_KEY_DEFAULT_LIMIT,
  };
}

export function buildContainer(options: ContainerOptions) {
  const { env, db } = options;
  const settingDefaults = settingsFromEnvironment(env);
  const settings = options.settings ?? settingDefaults;
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
  const study = new DrizzleStudyRepository(db);
  const notificationRepository = new DrizzleNotificationRepository(db);
  const settingsDeps = { settings: new DrizzleSettingsRepository(db), defaults: settingDefaults, clock };
  const getSettings = makeGetSettings(settingsDeps);
  const aiUsage = new DrizzleAiUsageRepository(db);
  const modelPrices = new DrizzleModelPriceRepository(db);
  const usageLimits = new DrizzleUsageLimitRepository(db);
  const recordAiUsage = makeRecordAiUsage({ usage: aiUsage, prices: modelPrices, clock, ids });
  const notify = makeNotify({ notifications: notificationRepository, clock, ids });

  const silentTts = new SilentTtsProvider();
  const tts: TtsProvider =
    options.tts ?? (settings.kokoroUrl ? new KokoroTtsProvider(settings.kokoroUrl) : silentTts);

  const masterKey = options.masterKey ?? env.AI_CREDENTIALS_MASTER_KEY;
  if (!masterKey) throw new Error("chave mestra ausente");
  const cipher = new AesGcmCipher(masterKey);
  const resolveCredential = makeResolveCredential({ credentials, cipher });
  const environmentServices = new Set<CredentialService>();
  if (env.GEMINI_API_KEY) environmentServices.add("gemini");
  if (hasTmdbCredentials(env)) environmentServices.add("tmdb");
  if (env.OPENSUBTITLES_API_KEY) environmentServices.add("opensubtitles");

  const fakeMetadata = new FakeMetadataProvider();
  const environmentMetadata = hasTmdbCredentials(env)
    ? new TmdbMetadataProvider(
        new TmdbClient({ readAccessToken: env.TMDB_READ_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY }),
      )
    : null;
  const defaultMetadata: MetadataProvider = options.metadata ?? environmentMetadata ?? fakeMetadata;
  const metadataBySecret = new Map<string, MetadataProvider>();
  async function metadataFor(userId: string | null): Promise<MetadataProvider> {
    if (options.metadata) return options.metadata;
    const stored = await resolveCredential(userId, "tmdb");
    if (!stored) return defaultMetadata;
    const key = fingerprint(stored.secret);
    const known = metadataBySecret.get(key);
    if (known) return known;
    const created = new TmdbMetadataProvider(
      new TmdbClient(
        tmdbSecretKind(stored.secret) === "apiKey"
          ? { apiKey: stored.secret }
          : { readAccessToken: stored.secret },
      ),
    );
    metadataBySecret.set(key, created);
    return created;
  }

  const fakeSubtitleSource = new FakeSubtitleSourceProvider();
  const environmentSubtitleSource = env.OPENSUBTITLES_API_KEY
    ? new OpenSubtitlesProvider({
        apiKey: env.OPENSUBTITLES_API_KEY,
        username: env.OPENSUBTITLES_USERNAME,
        password: env.OPENSUBTITLES_PASSWORD,
      })
    : null;
  const defaultSubtitleSource: SubtitleSourceProvider =
    options.subtitleSource ?? environmentSubtitleSource ?? fakeSubtitleSource;
  const subtitleSourceBySecret = new Map<string, SubtitleSourceProvider>();
  type SourceAccess = { provider: SubtitleSourceProvider; quotaKey: string; ownKey: boolean };
  async function sourceAccessFor(userId: string): Promise<SourceAccess> {
    const shared = { provider: defaultSubtitleSource, quotaKey: defaultSubtitleSource.name, ownKey: false };
    if (options.subtitleSource) return shared;
    const stored = await resolveCredential(userId, "opensubtitles");
    if (!stored) return shared;
    const key = fingerprint(stored.secret);
    const provider = subtitleSourceBySecret.get(key) ?? new OpenSubtitlesProvider({ apiKey: stored.secret });
    subtitleSourceBySecret.set(key, provider);
    return { provider, quotaKey: `${provider.name}:${key}`, ownKey: stored.origin === "user" };
  }

  type ResolvedAiAccess = AiAccess & { shared: boolean; model: string };
  type AiPurpose = "generation" | "embedding";
  const modelChoices = new DrizzleModelChoiceRepository(db);
  const getAiModels = makeGetAiModels({ choices: modelChoices });
  async function aiCredentialFor(
    userId: string,
    service: AiService,
  ): Promise<(AiAccess & { shared: boolean }) | null> {
    const stored = await resolveCredential(userId, service);
    if (stored) {
      const endpoint = parseEndpoint(stored.secret);
      const shared = stored.origin === "global";
      return endpoint
        ? { provider: service, apiKey: endpoint.apiKey, baseUrl: endpoint.baseUrl, shared }
        : { provider: service, apiKey: stored.secret, baseUrl: null, shared };
    }
    if (service === "gemini" && env.GEMINI_API_KEY) {
      return { provider: "gemini", apiKey: env.GEMINI_API_KEY, baseUrl: null, shared: true };
    }
    return null;
  }
  async function aiAccessFor(
    userId: string,
    purpose: AiPurpose = "generation",
  ): Promise<ResolvedAiAccess | null> {
    const chosen = (await getAiModels(userId))[purpose];
    if (chosen === "local") return null;
    const fallback = purpose === "generation" ? settings.aiGeneration : settings.aiEmbedding;
    for (const choice of [chosen, fallback]) {
      if (!choice) continue;
      if (!settings.aiCustomEndpointsAllowed && SECRET_KINDS[choice.provider] === "endpoint") continue;
      const credential = await aiCredentialFor(userId, choice.provider);
      if (credential) return { ...credential, model: choice.model };
    }
    return null;
  }
  const keySourceOf = async (userId: string): Promise<KeySource | null> => {
    const access = await aiAccessFor(userId);
    return access ? (access.shared ? "global" : "user") : null;
  };
  const asPerson = async (user: { id: string; name: string; avatarColor: string }): Promise<UsagePerson> => ({
    id: user.id,
    name: user.name,
    avatarColor: user.avatarColor,
    timezone: (await identity.get(user.id))?.timezone ?? DEFAULT_TIMEZONE,
  });
  const usageDeps = {
    usage: aiUsage,
    prices: modelPrices,
    limits: usageLimits,
    clock,
    sharedDefault: async () => (await getSettings()).aiSharedLimit,
    personOf: async (userId: string) => {
      const user = await identity.findById(userId);
      return user ? asPerson(user) : null;
    },
    keySourceOf,
    listPeople: async () => Promise.all((await identity.listByEmailSuffix("")).map(asPerson)),
  };
  const ensureAiAllowed = makeEnsureAiAllowed(usageDeps);
  function aiMeterFor(userId: string, access: ResolvedAiAccess): AiUsageMeter {
    return meterFor(recordAiUsage, ensureAiAllowed, userId, access.shared ? "global" : "user");
  }

  const localeOf = async (userId: string): Promise<Locale> =>
    (await identity.get(userId))?.locale ?? DEFAULT_LOCALE;
  const pairFor = async (userId: string): Promise<LanguagePair> => {
    const preferences = await identity.get(userId);
    return preferences ? pairOf(preferences) : { target: DEFAULT_TARGET_LANGUAGE, native: "pt-BR" };
  };
  const promptLanguagesOf = async (userId: string) => ({
    locale: await localeOf(userId),
    pair: await pairFor(userId),
  });

  const fakeLlm = new FakeLlmProvider();
  const resolveLlm =
    options.llmForUser ??
    (async (userId: string): Promise<LlmProvider> => {
      const access = await aiAccessFor(userId);
      if (!access) return fakeLlm;
      return new AiLlmProvider(access, access.model, {
        meter: aiMeterFor(userId, access),
        ...(await promptLanguagesOf(userId)),
      });
    });
  const resolvePlanner =
    options.plannerForUser ??
    (async (userId: string): Promise<LessonPlanner | null> => {
      const access = await aiAccessFor(userId);
      if (!access) return null;
      const meter = aiMeterFor(userId, access);
      await meter.ensureAllowed();
      return new AiLessonPlanner(access, access.model, { meter, ...(await promptLanguagesOf(userId)) });
    });

  const fakeTutor = new FakeTutorProvider();
  const resolveTutor =
    options.tutorForUser ??
    (async (userId: string): Promise<TutorProvider> => {
      const access = await aiAccessFor(userId);
      if (!access) return fakeTutor;
      return new AiTutorProvider(access, access.model, {
        meter: aiMeterFor(userId, access),
        ...(await promptLanguagesOf(userId)),
      });
    });
  const conversations = new DrizzleConversationRepository(db);

  const localEmbedding = new HashEmbeddingProvider();
  const resolveEmbedding =
    options.embeddingForUser ??
    (async (userId: string): Promise<EmbeddingProvider> => {
      const access = await aiAccessFor(userId, "embedding");
      if (!access || !PROVIDERS_WITH_EMBEDDINGS.has(access.provider)) return localEmbedding;
      return new AiEmbeddingProvider(access, access.model, aiMeterFor(userId, access));
    });
  const resolveSuggestionWriter =
    options.suggestionWriterForUser ??
    (async (userId: string): Promise<SuggestionWriter | null> => {
      const access = await aiAccessFor(userId);
      if (!access) return null;
      return new AiSuggestionWriter(access, access.model, {
        meter: aiMeterFor(userId, access),
        ...(await promptLanguagesOf(userId)),
      });
    });
  const recommendationDeps = {
    repository: new DrizzleRecommendationRepository(db),
    resolveCandidates: (userId: string) => metadataFor(userId),
    resolveEmbedding,
    localEmbedding,
    resolveWriter: resolveSuggestionWriter,
    clock,
    onFallback: (stage: string, reason: string) => log.warn("recommendations.fallback", { stage, reason }),
  };

  const sessionDeps = {
    users: identity,
    sessions: identity,
    preferences: identity,
    pairs: identity,
    passwords: scryptPasswords,
    tokens: randomSessionTokens,
    clock,
    ids,
  };
  const catalogDeps = { catalog, progress: catalog, clock, ids };
  const buildCatalogUseCases = (metadata: MetadataProvider) => {
    const deps = { ...catalogDeps, metadata };
    return {
      searchWorks: makeSearchWorks(deps),
      registerWork: makeRegisterWork(deps),
      refreshWork: makeRefreshWork(deps),
      loadSeasonEpisodes: makeLoadSeasonEpisodes(deps),
    };
  };
  const catalogByProvider = new WeakMap<MetadataProvider, ReturnType<typeof buildCatalogUseCases>>();
  async function catalogFor(userId: string | null) {
    const metadata = await metadataFor(userId);
    const known = catalogByProvider.get(metadata);
    if (known) return known;
    const created = buildCatalogUseCases(metadata);
    catalogByProvider.set(metadata, created);
    return created;
  }

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

  const generateCardDrafts = makeGenerateCardDrafts(learningDeps);

  async function loadTrailLines(episodeId: string, pair: LanguagePair): Promise<TrailLine[] | null> {
    const script = await getEpisodeScript(episodeId, pair);
    if (!script) return null;
    return script.lines.map((line) => ({
      cueId: line.cueId,
      startMs: line.startMs,
      text: line.text,
      sceneIndex: line.sceneIndex,
      translation: line.translationSource === "subtitle_pt" ? line.translation : null,
    }));
  }

  async function queueLinesForReview(
    userId: string,
    episodeId: string,
    pair: LanguagePair,
    items: { cueId: string; translation: string | null }[],
  ): Promise<number> {
    const script = await getEpisodeScript(episodeId, pair);
    if (!script) return 0;
    const reusable = new Map(
      (await learning.findReusable(userId, episodeId, pair)).map((item) => [
        `${item.cueId}:${item.startToken}:${item.endToken}`,
        item.id,
      ]),
    );
    const itemIds: string[] = [];
    for (const { cueId, translation } of items) {
      const line = script.lines.find((candidate) => candidate.cueId === cueId);
      const fromSubtitle = line?.translationSource === "subtitle_pt" ? line.translation : null;
      const meaning = fromSubtitle ?? translation;
      if (!line || !meaning) continue;
      const endToken = tokenize(line.text).length - 1;
      const known = reusable.get(`${cueId}:0:${endToken}`);
      if (known) {
        itemIds.push(known);
        continue;
      }
      const id = ids.next();
      const source = fromSubtitle ? ("subtitle_pt" as const) : ("llm" as const);
      await learning.createItem({
        id,
        episodeId,
        pair,
        visibility: "private",
        ownerUserId: userId,
        createdAt: clock.now(),
        draft: {
          key: id,
          highlightId: id,
          cueId,
          startToken: 0,
          endToken,
          kind: "line",
          term: line.text,
          itemType: "sentence",
          difficulty: "B1",
          meaning,
          meaningSource: source,
          pronunciation: null,
          exampleEnglish: null,
          examplePortuguese: null,
          lineText: line.text,
          lineTranslation: meaning,
          lineTranslationSource: source,
          startMs: line.startMs,
          endMs: line.endMs,
          reusedItemId: null,
        },
      });
      itemIds.push(id);
    }
    const created = await addCards(
      userId,
      itemIds.map((learningItemId) => ({ learningItemId, sourceKind: "lesson_error" })),
    );
    await cards.bringForward(userId, itemIds, clock.now());
    return Math.max(created, itemIds.length);
  }

  async function queueCorrections(
    userId: string,
    corrections: Correction[],
    _sourceLabel: string,
  ): Promise<number> {
    const pair = await pairFor(userId);
    const itemIds: string[] = [];
    for (const correction of corrections) {
      itemIds.push(
        await learning.upsertStandaloneItem({
          id: ids.next(),
          ownerUserId: userId,
          pair,
          term: correction.right,
          meaning: correction.why,
          context: correction.wrong,
          origin: "tutor_correction",
          createdAt: clock.now(),
        }),
      );
    }
    await addCards(
      userId,
      itemIds.map((learningItemId) => ({ learningItemId, sourceKind: "tutor" })),
    );
    await cards.bringForward(userId, itemIds, clock.now());
    return itemIds.length;
  }

  const conversationDeps = { conversations, resolveTutor, queueCorrections, awardXp, clock, ids };
  const getTurnSpeechText = makeGetTurnSpeechText(conversationDeps);

  const studyDeps = {
    study,
    plans: study,
    resolvePlanner,
    notify,
    clock,
    ids,
    loadLines: loadTrailLines,
    awardXp,
    queueForReview: queueLinesForReview,
    saveProgress: async (userId: string, episodeId: string, percent: number) => {
      const known = (await catalog.listForUser(userId)).find((entry) => entry.episodeId === episodeId);
      await catalog.upsert(userId, episodeId, Math.max(percent, known?.progressPercent ?? 0), clock.now());
    },
  };

  async function findCueInLanguage(cueId: string, language: StudyLanguage) {
    const cue = await subtitles.findCue(cueId);
    return cue && cue.language === language ? cue : null;
  }

  const importEpisodeSubtitles = makeImportEpisodeSubtitles({
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
  });
  const findEpisodeSource = async (
    subtitleSource: SubtitleSourceProvider,
    episodeId: string,
  ): Promise<EpisodeSource | null> => {
    const context = await catalog.findEpisodeContext(episodeId);
    if (!context) return null;
    const tmdbId =
      context.media.metadataProvider === "tmdb"
        ? tmdbNumericId(context.media.type, context.media.externalId)
        : null;
    const reference = tmdbId ?? (subtitleSource.name === "fake" ? "0" : null);
    const files = await subtitles.listFiles(episodeId);
    return {
      episodeId,
      query:
        reference === null
          ? null
          : context.media.type === "movie"
            ? { kind: "movie", tmdbId: reference }
            : {
                kind: "episode",
                showTmdbId: reference,
                seasonNumber: context.season.seasonNumber,
                episodeNumber: context.episode.episodeNumber,
              },
      existing: files.map((file) => ({
        language: file.language,
        externalFileId: file.origin?.externalFileId ?? null,
      })),
    };
  };
  const sourceRepository = new DrizzleSourceRepository(db);
  const buildSourceUseCases = (access: SourceAccess) => {
    const deps = {
      provider: access.provider,
      quotaKey: access.quotaKey,
      sources: sourceRepository,
      userDailyDownloads: access.ownKey ? UNLIMITED_DOWNLOADS : settings.subtitleDownloadsPerUserPerDay,
      clock,
      findEpisodeSource: (episodeId: string) => findEpisodeSource(access.provider, episodeId),
      readExistingFile: async (episodeId: string, language: StudyLanguage) => {
        const file = (await subtitles.listFiles(episodeId)).find((stored) => stored.language === language);
        return file ? storage.read(file.storagePath) : null;
      },
      importSubtitles: importEpisodeSubtitles,
    };
    return { searchSubtitles: makeSearchSubtitles(deps), importFromSource: makeImportFromSource(deps) };
  };
  const sourceUseCases = new Map<string, ReturnType<typeof buildSourceUseCases>>();
  async function sourcesFor(userId: string) {
    const access = await sourceAccessFor(userId);
    const key = `${access.quotaKey}|${access.ownKey ? "own" : "shared"}`;
    const known = sourceUseCases.get(key);
    if (known) return known;
    const created = buildSourceUseCases(access);
    sourceUseCases.set(key, created);
    return created;
  }
  const credentialDeps = {
    credentials,
    cipher,
    clock,
    environmentServices,
    testCredential: options.testCredential ?? testServiceCredential,
    endpointsAllowed: async () => (await getSettings()).aiCustomEndpointsAllowed,
  };

  const packageCatalog = new DrizzlePackageCatalog({
    db,
    catalog,
    subtitles,
    learning,
    audio: audioAssets,
    importSubtitles: async (input) =>
      (await importEpisodeSubtitles({ ...input, native: input.native ?? undefined })).outcome,
    ids,
    voices: [...ALL_VOICES],
    modelVersion: tts.modelVersion,
  });
  const personalData = new DrizzlePersonalData({ db, catalog, learning, keyCipher: cipher, ids });
  const account = {
    emailOf: async (userId: string) => (await identity.findById(userId))?.email ?? null,
    verifyPassword: async (userId: string, password: string) => {
      const user = await identity.findById(userId);
      const record = user ? await identity.findByEmail(user.email) : null;
      return scryptPasswords.verify(password, record?.passwordHash ?? null);
    },
  };
  const packageDeps = {
    reader: packageCatalog,
    writer: packageCatalog,
    archive: new FflateArchive(),
    storage,
    clock,
    ids,
    personal: personalData,
    cipher: new NodePersonalCipher(),
    account,
  };

  return {
    providers: { metadata: defaultMetadata.name, tts: tts.name, subtitles: defaultSubtitleSource.name },
    listCatalogWorks: async () => (await catalog.listCatalog()).map((entry) => entry.media),
    listEpisodesByMedia: (mediaId: string) => catalog.listEpisodesByMedia(mediaId),
    exportPackage: makeExportPackage(packageDeps),
    exportPersonalPackage: makeExportPersonalPackage(packageDeps),
    inspectPackage: makeInspectPackage(packageDeps),
    importPackage: makeImportPackage(packageDeps),
    peekPersonalEmail: makePeekPersonalEmail(packageDeps),
    metadataNameFor: async (userId: string) => (await metadataFor(userId)).name,
    devShortcuts: env.DEV_SHORTCUTS,
    secureSessionCookie: env.SESSION_COOKIE_SECURE,
    loginThrottle: new AttemptThrottle(MAX_LOGIN_FAILURES, LOGIN_WINDOW_MS, clock),

    signIn: makeSignIn(sessionDeps),
    signUp: makeSignUp(sessionDeps),
    signOut: makeSignOut(sessionDeps),
    findOwner: makeFindOwner(sessionDeps),
    getPreferences: (userId: string) => identity.get(userId),
    startOwnerSession: makeStartOwnerSession(sessionDeps),
    getSessionUser: makeGetSessionUser(sessionDeps),
    updatePreferences: makeUpdatePreferences({ preferences: identity, pairs: identity, clock }),
    listLanguagePairs: makeListLanguagePairs({ pairs: identity, preferences: identity }),
    addLanguagePair: makeAddLanguagePair({ pairs: identity, preferences: identity, clock }),
    switchLanguagePair: makeSwitchLanguagePair({ pairs: identity, preferences: identity }),
    listPeople: () => identity.listByEmailSuffix(""),

    searchWorks: async (userId: string, query: string) => (await catalogFor(userId)).searchWorks(query),
    registerWork: async (input: {
      userId: string | null;
      type: MediaType;
      externalId: string;
      force?: boolean;
    }) => (await catalogFor(input.userId)).registerWork(input),
    refreshWork: async (input: { userId: string; mediaId: string; force: boolean }) =>
      (await catalogFor(input.userId)).refreshWork(input),
    loadSeasonEpisodes: async (input: {
      userId: string;
      mediaId: string;
      seasonNumber: number;
      force?: boolean;
    }) => (await catalogFor(input.userId)).loadSeasonEpisodes(input),
    getCatalogOverview: makeGetCatalogOverview(catalogDeps),
    getMediaDetail: makeGetMediaDetail(catalogDeps),
    getEpisodeContext: makeGetEpisodeContext(catalogDeps),
    startEpisode: makeStartEpisode(catalogDeps),
    listSeasons: (mediaId: string) => catalog.listSeasons(mediaId),
    getMediaById: (mediaId: string) => catalog.findMediaById(mediaId),

    importEpisodeSubtitles,
    searchSubtitles: async (input: { userId: string; episodeId: string; refresh?: boolean }) =>
      (await sourcesFor(input.userId)).searchSubtitles({ ...input, pair: await pairFor(input.userId) }),
    importFromSource: async (input: {
      userId: string;
      episodeId: string;
      pair: LanguagePair;
      targetFileId: string;
      nativeFileId: string | null;
    }) => (await sourcesFor(input.userId)).importFromSource(input),
    listSubtitleOrigins: async (episodeId: string) =>
      (await subtitles.listFiles(episodeId)).map((file) => ({
        language: file.language,
        origin: file.origin,
      })),
    getEpisodeScript,

    ensurePlan: makeEnsurePlan(studyDeps),
    generatePlan: makeGeneratePlan(studyDeps),
    savePlan: (input: Parameters<typeof study.saveReady>[0]) => study.saveReady(input),
    getTrail: makeGetTrail(studyDeps),

    startConversation: makeStartConversation(conversationDeps),
    getConversation: makeGetConversation(conversationDeps),
    listConversations: makeListConversations(conversationDeps),
    sendMessage: makeSendMessage(conversationDeps),
    reviewConversation: makeReviewConversation(conversationDeps),
    getTurnSpeechText,
    isTutorSimulated: async (userId: string) => (await resolveTutor(userId)).name === "fake",
    startLesson: makeStartLesson(studyDeps),
    completeLesson: makeCompleteLesson(studyDeps),

    getReadingView: makeGetReadingView(highlightDeps),
    syncHighlights: makeSyncHighlights(highlightDeps),

    generateCardDrafts,
    requestCardDrafts: makeRequestCardDrafts({ learning, clock, ids }),
    processCardBatch: makeProcessCardBatch({ learning, generate: generateCardDrafts, notify }),
    getCardBatch: makeGetCardBatch({ learning, clock }),
    notify,
    getInbox: makeGetInbox({ notifications: notificationRepository }),
    markNotificationsRead: makeMarkNotificationsRead({ notifications: notificationRepository }),
    confirmCardBatch: makeConfirmCardBatch(learningDeps),
    listCatalogSuggestions: makeListCatalogSuggestions({ learning }),
    getSpeakableItem: makeGetSpeakableItem({ learning }),
    translateCue: makeTranslateCue({
      resolveLlm,
      saveCueTranslation: (cueId, pair, text) =>
        subtitles.saveCueTranslation(cueId, pair.native, text, clock.now()),
      findCueLine: async (cueId, pair) => {
        const cue = await findCueInLanguage(cueId, pair.target);
        if (!cue) return null;
        const script = await getEpisodeScript(cue.episodeId, pair);
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
    getCueSpeech: async (cueId: string): Promise<{ text: string; language: StudyLanguage }> => {
      const cue = await subtitles.findCue(cueId);
      if (!cue) throw new AppError("CUE_NOT_FOUND");
      return { text: cue.text, language: cue.language };
    },
    getTurnSpeech: async (
      userId: string,
      turnId: string,
    ): Promise<{ text: string; language: StudyLanguage }> => ({
      text: await getTurnSpeechText(userId, turnId),
      language: (await pairFor(userId)).target,
    }),

    listDueCards: makeListDueCards({ cards, clock }),
    countDueCards: makeCountDueCards({ cards, clock }),
    gradeCard: makeGradeCard({ cards, clock, ids, awardXp }),
    getAnticipationStatus: makeGetAnticipationStatus({ cards, clock }),
    anticipateReview: makeAnticipateReview({ cards, clock, ids }),
    addCards,

    getSettings,
    updateSettings: makeUpdateSettings(settingsDeps),
    getAiUsageSummary: makeGetAiUsageSummary(usageDeps),
    getAiUsageOverview: makeGetAiUsageOverview(usageDeps),
    setAiUsageLimit: makeSetAiUsageLimit(usageDeps),
    saveModelPrice: makeSaveModelPrice(usageDeps),
    saveCredential: makeSaveCredential(credentialDeps),
    removeCredential: makeRemoveCredential(credentialDeps),
    getCredentialOverview: makeGetCredentialOverview(credentialDeps),
    getAiModels,
    setAiModels: makeSetAiModels({ choices: modelChoices, clock }),

    getRecommendations: makeGetRecommendations(recommendationDeps),
    refreshRecommendations: makeRefreshRecommendations(recommendationDeps),
    dismissRecommendation: makeDismissRecommendation(recommendationDeps),
    acceptRecommendation: makeAcceptRecommendation(recommendationDeps),
    findRecommendation: (userId: string, workKey: string) =>
      recommendationDeps.repository.findSuggestion(userId, workKey),

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

    getProfileSummary: makeGetProfileSummary({
      xp: gamification,
      snapshots: gamification,
      counts: gamification,
      clock,
    }),
    settleMissions: makeSettleMissions({ xp: gamification, counts: gamification, clock, ids }),
    saveSnapshot: makeSaveSnapshot({ snapshots: gamification, clock }),
    awardXp,
  };
}

export type Container = ReturnType<typeof buildContainer>;

type ActiveDatabase = { url: string; handle: DatabaseHandle };
const globalStore = globalThis as typeof globalThis & { __deixaActiveDatabase?: ActiveDatabase };
let container: Container | undefined;
let containerUrl: string | undefined;

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("database not configured");
    this.name = "DatabaseNotConfigured";
  }
}

export class SettingsNotLoaded extends Error {
  constructor() {
    super("server settings not loaded yet");
    this.name = "SettingsNotLoaded";
  }
}

export function resolveDatabaseUrl(): string | null {
  return getEnv().DATABASE_URL ?? readStoredDatabaseUrl(configDirectory());
}

function activeDatabase(url: string): DatabaseHandle {
  const active = globalStore.__deixaActiveDatabase;
  if (active?.url === url) return active.handle;
  void active?.handle.close().catch(() => undefined);
  const handle = openDatabase(url);
  globalStore.__deixaActiveDatabase = { url, handle };
  return handle;
}

let settingsSnapshot: { url: string; values: AppSettings; stamp: string } | undefined;
let containerSettings: string | undefined;

export async function pingDatabase(url: string): Promise<void> {
  await activeDatabase(url).db.execute(sql`select 1`);
}

export async function refreshSettings(): Promise<void> {
  const url = resolveDatabaseUrl();
  if (!url) return;
  const stored = await new DrizzleSettingsRepository(activeDatabase(url).db).load();
  const values = mergeSettings(settingsFromEnvironment(getEnv()), stored);
  settingsSnapshot = { url, values, stamp: JSON.stringify(values) };
}

export function getContainer(): Container {
  const url = resolveDatabaseUrl();
  if (!url) throw new DatabaseNotConfigured();
  const snapshot = settingsSnapshot?.url === url ? settingsSnapshot : undefined;
  if (!snapshot) throw new SettingsNotLoaded();
  if (!container || containerUrl !== url || containerSettings !== snapshot.stamp) {
    const env = getEnv();
    const masterKey = loadMasterKey({
      fromEnvironment: env.AI_CREDENTIALS_MASTER_KEY,
      directory: configDirectory(),
    });
    if (masterKey.origin === "created" || masterKey.origin === "replaced") {
      defaultLogger.warn("master_key.generated", { origin: masterKey.origin });
    }
    container = buildContainer({
      env,
      db: activeDatabase(url).db,
      masterKey: masterKey.value,
      settings: snapshot.values,
    });
    containerUrl = url;
    containerSettings = snapshot.stamp;
  }
  return container;
}
