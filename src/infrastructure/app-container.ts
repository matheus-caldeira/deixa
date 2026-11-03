import { DrizzleCredentialRepository } from "@/modules/ai-credentials/infrastructure/drizzle-credential-repository";
import {
  PROVIDERS_WITH_EMBEDDINGS,
  SECRET_KINDS,
  makeAssignAiModel,
  makeGetAiModels,
  makeGetAssignedModel,
  makeListModelAssignments,
  makeGetCredentialOverview,
  makeRemoveCredential,
  makeResolveCredential,
  makeSaveCredential,
  makeSetAiModels,
  pickAiModel,
  parseEndpoint,
  tmdbSecretKind,
  type AiService,
  type CredentialService,
  type CredentialTester,
} from "@/modules/ai-credentials";
import {
  ALL_VOICES,
  makeGetSpeechAudio,
  makeListCachedSpeech,
  makeSynthesizeLines,
  makeTranscribeSpeech,
  voiceFor,
  type SpeechToText,
  type TtsProvider,
} from "@/modules/audio";
import { DrizzleAudioAssetRepository } from "@/modules/audio/infrastructure/drizzle-audio-asset-repository";
import { PerUserGate } from "@/modules/audio/infrastructure/per-user-gate";
import { SilentTtsProvider } from "@/modules/audio/infrastructure/silent-tts-provider";
import {
  makeGetCatalogOverview,
  makeGetEpisodeContext,
  makeGetMediaDetail,
  makeAddLevelSource,
  makeBrowseWorks,
  makeExportLevelRatings,
  makeGetWorkLevelRatings,
  makeRateWorkLevel,
  type LevelRater,
  makeListLevelSources,
  makeLoadSeasonEpisodes,
  makeRefreshWork,
  makeRegisterWork,
  makeRemoveLevelSource,
  makeResolveLevelRatings,
  makeSearchWorks,
  makeSetLevelSourceEnabled,
  makeStartEpisode,
  makeSyncLevelSources,
  type MediaType,
  type MetadataProvider,
} from "@/modules/catalog";
import { DrizzleCatalogRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repository";
import { FakeMetadataProvider } from "@/modules/catalog/infrastructure/fake-metadata-provider";
import { LevelGuidedMetadataProvider, builtinLevelGuide } from "@/modules/catalog/infrastructure/level-guide";
import { DrizzleLevelSourceRepository } from "@/modules/catalog/infrastructure/drizzle-level-source-repository";
import { DrizzleAiLevelRatingRepository } from "@/modules/catalog/infrastructure/drizzle-ai-level-rating-repository";
import { AiLevelRater } from "./ai/ai-level-rater";
import { AiSpeechToText } from "./ai/ai-speech-to-text";
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
  makeGetLearnerProfile,
  makeGetTurnSpeechText,
  makeCloseConversation,
  makeConfirmConversationCards,
  makeListConversations,
  makeRequestConversationReview,
  makeRequestTermCards,
  makeRunConversationReview,
  makeRunTermCards,
  makeSendMessage,
  makeStartConversation,
  type CardPlacement,
  type ConversationNotification,
  type NewCard,
  type TutorProvider,
} from "@/modules/conversations";
import {
  makeCompletePersonalLesson,
  makeGetEpisodeTrail,
  makeGetPersonalSeries,
  makeGetSeasonContext,
  makePlaceCards,
  makeRefreshSeriesDescription,
  makeRenameSeries,
  makeSetSeriesLevel,
  makeBuildPersonalRecap,
  makeStartPersonalLesson,
  type DescribeSeriesInput,
} from "@/modules/personal-series";
import { DrizzlePersonalSeriesRepository } from "@/modules/personal-series/infrastructure/drizzle-personal-series-repository";
import { DrizzleConversationRepository } from "@/modules/conversations/infrastructure/drizzle-conversation-repository";
import { FakeTutorProvider } from "@/modules/conversations/infrastructure/fake-tutor-provider";
import {
  levelProgressPercent,
  makeAwardXp,
  makeGetProfileSummary,
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
  makeGetWorkTrail,
  makeCompleteRecap,
  makeCountDueRecaps,
  makeListRecaps,
  makeStartRecap,
  pickRecapExercises,
  type RecapSource,
  makeStartLesson,
  type LessonPlanner,
  type TrailLine,
} from "@/modules/study";
import type { CefrLevel } from "@/shared/levels";
import { DrizzleRecapRepository } from "@/modules/study/infrastructure/drizzle-recap-repository";
import { DrizzleStudyRepository } from "@/modules/study/infrastructure/drizzle-study-repository";
import {
  makeImportFromSource,
  makeSearchSubtitles,
  type EpisodeSource,
  type SubtitleSourceProvider,
} from "@/modules/subtitle-sources";
import { DrizzleSourceRepository } from "@/modules/subtitle-sources/infrastructure/drizzle-source-repository";
import {
  makeAcceptRecommendation,
  makeDismissRecommendation,
  makeGetLearnerInsight,
  makeGetRecommendations,
  makeRefreshRecommendations,
  type EmbeddingProvider,
  type SuggestionWriter,
} from "@/modules/recommendations";
import { DrizzleRecommendationRepository } from "@/modules/recommendations/infrastructure/drizzle-recommendation-repository";
import { HashEmbeddingProvider } from "@/modules/recommendations/infrastructure/hash-embedding-provider";
import { makeGetSettings, makeUpdateSettings, type AppSettings } from "@/modules/settings";
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
import {
  makeGetEpisodeScript,
  makeImportEpisodeSubtitles,
  type AudioMode,
  type FindEpisodeLocation,
} from "@/modules/subtitles";
import {
  makeEnqueueJob,
  makeHasPendingJob,
  makeRunClaimedJob,
  makeRunJobInline,
  makeRunNextJob,
  type JobHandlers,
} from "@/modules/jobs";
import { DrizzleJobRepository } from "@/modules/jobs/infrastructure/drizzle-job-repository";
import { makeGetScriptSummary, makeImportEpisodeScript, makeListScriptCompletions } from "@/modules/scripts";
import { DrizzleScriptRepository } from "@/modules/scripts/infrastructure/drizzle-script-repository";
import { DrizzleSubtitleRepository } from "@/modules/subtitles/infrastructure/drizzle-subtitle-repository";
import { systemClock, type Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { uuidGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { tokenize } from "@/shared/text";
import { hasTmdbCredentials, type Env } from "./config/env";
import { testServiceCredential } from "./credential-tester";
import type { Database } from "./database/client";
import { AiEmbeddingProvider } from "./ai/ai-embedding-provider";
import { AiLessonPlanner } from "./ai/ai-lesson-planner";
import { AiLlmProvider } from "./ai/ai-llm-provider";
import { AiSuggestionWriter } from "./ai/ai-suggestion-writer";
import { AiTutorProvider } from "./ai/ai-tutor-provider";
import type { AiAccess } from "./ai/models";
import { logger as defaultLogger, type Logger } from "./logger/logger";
import { OpenSubtitlesProvider } from "./opensubtitles/opensubtitles-provider";
import { TmdbClient } from "./tmdb/client";
import { tmdbNumericId } from "./tmdb/mapping";
import { TmdbMetadataProvider } from "./tmdb/tmdb-metadata-provider";
import { routes } from "@/shared/routes";
import { sha256Hex } from "@/shared/hash";
import type { Platform } from "./platform";

const MAX_AUDIO_GENERATIONS_PER_USER = 2;
const MAX_LOGIN_FAILURES = 8;
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const FINGERPRINT_CHARS = 16;
const UNLIMITED_DOWNLOADS = Number.MAX_SAFE_INTEGER;
const MISTAKE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MISTAKES_FOR_TUTOR = 6;
const CLOSED_SESSIONS_FOR_HINTS = 50;
const FULL_PERCENT = 100;

const fingerprint = (secret: string): string => sha256Hex(secret).slice(0, FINGERPRINT_CHARS);

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
  speechToTextForUser?: (userId: string) => Promise<SpeechToText | null>;
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

export function buildAppContainer(options: ContainerOptions & { platform: Platform }) {
  const { platform } = options;
  const { env, db } = options;
  const settingDefaults = settingsFromEnvironment(env);
  const settings = options.settings ?? settingDefaults;
  const log = options.logger ?? defaultLogger;
  const clock = options.clock ?? systemClock;
  const ids = uuidGenerator;
  const storage = options.storage ?? platform.storage(env);

  const identity = new DrizzleIdentityRepository(db);
  const catalog = new DrizzleCatalogRepository(db);
  const levelSourceDeps = {
    sources: new DrizzleLevelSourceRepository(db),
    fetcher: platform.levelSourceFetcher(env),
    builtin: builtinLevelGuide,
    aiRatings: new DrizzleAiLevelRatingRepository(db),
    catalog,
    clock,
    ids,
  };
  const resolveLevelRatings = makeResolveLevelRatings(levelSourceDeps);
  const syncLevelSources = makeSyncLevelSources(levelSourceDeps);
  const resolveLevelRanges = async (externalIds: readonly string[]) =>
    new Map(
      [...(await resolveLevelRatings(externalIds))].flatMap(([externalId, entry]) =>
        entry.range ? [[externalId, entry.range] as const] : [],
      ),
    );
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
  const tts: TtsProvider = options.tts ?? (settings.kokoroUrl ? platform.tts(settings.kokoroUrl) : silentTts);

  const masterKey = options.masterKey ?? env.AI_CREDENTIALS_MASTER_KEY;
  if (!masterKey) throw new Error("chave mestra ausente");
  const cipher = platform.cipher(masterKey);
  const resolveCredential = makeResolveCredential({ credentials, cipher });
  const environmentServices = new Set<CredentialService>();
  if (env.GEMINI_API_KEY) environmentServices.add("gemini");
  if (hasTmdbCredentials(env)) environmentServices.add("tmdb");
  if (env.OPENSUBTITLES_API_KEY) environmentServices.add("opensubtitles");

  const fakeMetadata = new FakeMetadataProvider();
  const environmentMetadata = hasTmdbCredentials(env)
    ? new LevelGuidedMetadataProvider(
        new TmdbMetadataProvider(
          new TmdbClient({ readAccessToken: env.TMDB_READ_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY }),
        ),
        resolveLevelRanges,
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
    const created = new LevelGuidedMetadataProvider(
      new TmdbMetadataProvider(
        new TmdbClient(
          tmdbSecretKind(stored.secret) === "apiKey"
            ? { apiKey: stored.secret }
            : { readAccessToken: stored.secret },
        ),
      ),
      resolveLevelRanges,
    );
    metadataBySecret.set(key, created);
    return created;
  }

  const fakeSubtitleSource = platform.fakeSubtitleSource();
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
  const getAssignedModel = makeGetAssignedModel({ choices: modelChoices });
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
    const picked = await pickAiModel({
      chosen,
      assigned: purpose === "generation" ? await getAssignedModel(userId) : null,
      serverDefault: purpose === "generation" ? settings.aiGeneration : settings.aiEmbedding,
      credentialFor: async (choice) =>
        !settings.aiCustomEndpointsAllowed && SECRET_KINDS[choice.provider] === "endpoint"
          ? null
          : aiCredentialFor(userId, choice.provider),
      isShared: (credential) => credential.shared,
    });
    return picked ? { ...picked.credential, model: picked.choice.model } : null;
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
    notify,
    onFallback: (stage: string, reason: string) => log.warn("recommendations.fallback", { stage, reason }),
  };
  const getLearnerInsight = makeGetLearnerInsight(recommendationDeps);

  const sessionDeps = {
    users: identity,
    sessions: identity,
    preferences: identity,
    pairs: identity,
    passwords: platform.passwords,
    tokens: platform.tokens,
    clock,
    ids,
  };
  const catalogDeps = { catalog, progress: catalog, clock, ids };
  const resolveLevelRater = async (userId: string): Promise<LevelRater | null> => {
    const access = await aiAccessFor(userId);
    if (!access) return null;
    const meter = aiMeterFor(userId, access);
    await meter.ensureAllowed();
    return new AiLevelRater(access, access.model, { meter, locale: await localeOf(userId) });
  };
  const resolveTranscriber = async (userId: string): Promise<SpeechToText | null> => {
    if (options.speechToTextForUser) return options.speechToTextForUser(userId);
    const access = await aiAccessFor(userId);
    if (!access) return null;
    const meter = aiMeterFor(userId, access);
    await meter.ensureAllowed();
    return new AiSpeechToText(access, access.model, { meter });
  };
  const buildCatalogUseCases = (metadata: MetadataProvider) => {
    const deps = { ...catalogDeps, metadata };
    const levelDeps = { ...levelSourceDeps, metadata, resolveRater: resolveLevelRater };
    return {
      browseWorks: makeBrowseWorks(levelDeps),
      rateWorkLevel: makeRateWorkLevel(levelDeps),
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

  async function createConversationCards(userId: string, newCards: NewCard[]): Promise<string[]> {
    const pair = await pairFor(userId);
    const itemIds: string[] = [];
    for (const card of newCards) {
      itemIds.push(
        await learning.upsertStandaloneItem({
          id: ids.next(),
          ownerUserId: userId,
          pair,
          term: card.term,
          meaning: card.meaning,
          context: card.context,
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
    return itemIds;
  }

  const learnerOf = async (userId: string) => {
    const preferences = await identity.get(userId);
    return {
      userId,
      pair: preferences ? pairOf(preferences) : { target: DEFAULT_TARGET_LANGUAGE, native: "pt-BR" as const },
      userLevel: preferences?.level ?? ("A1" as const),
    };
  };
  const personalSeriesRepository = new DrizzlePersonalSeriesRepository(db);
  const seriesDeps = {
    series: personalSeriesRepository,
    levelPercent: async (userId: string) =>
      levelProgressPercent({
        lessonsPassed: (await gamification.lessonStats(userId, null)).passed,
        cardsOwned: await gamification.cardsOwned(userId),
      }),
    describe: async (userId: string, input: DescribeSeriesInput) =>
      (await resolveTutor(userId)).describeSeries(input),
    learnerHints: async (userId: string, pair: LanguagePair) => {
      const [profile, sessions] = await Promise.all([
        makeGetLearnerProfile({ conversations, recentMistakes })(userId, pair.target),
        conversations.listSessions(userId, pair.target, CLOSED_SESSIONS_FOR_HINTS),
      ]);
      return {
        recentTopics: profile.recentTopics,
        improvements: profile.improvements,
        conversations: sessions.filter((session) => session.closedAt !== null).length,
      };
    },
    clock,
    ids,
  };
  const getSeasonContext = makeGetSeasonContext(seriesDeps);
  const placeSeriesCards = makePlaceCards(seriesDeps);

  const recentMistakes = async (userId: string, language: StudyLanguage) =>
    (
      await gamification.recurringMisses(
        userId,
        new Date(clock.now().getTime() - MISTAKE_WINDOW_MS),
        MISTAKES_FOR_TUTOR,
        language,
      )
    ).map((miss) => miss.term);
  const conversationDeps = {
    conversations,
    resolveTutor,
    recentMistakes,
    studyPortrait: getLearnerInsight,
    awardXp,
    seasonContext: async (userId: string) => getSeasonContext(await learnerOf(userId)),
    createCards: createConversationCards,
    placeCards: async (input: { userId: string; sessionId: string; cards: CardPlacement[] }) =>
      placeSeriesCards({
        ...(await learnerOf(input.userId)),
        sessionId: input.sessionId,
        cards: input.cards,
      }),
    notify: (input: ConversationNotification) => notify(input),
    clock,
    ids,
  };
  const getTurnSpeechText = makeGetTurnSpeechText(conversationDeps);

  const studyDeps = {
    study,
    plans: study,
    resolvePlanner,
    learnerChallenge: async (userId: string, pair: LanguagePair) =>
      (await getLearnerInsight(userId, pair.target))?.challenge ?? "steady",
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

  const recapRepository = new DrizzleRecapRepository(db);
  const getPersonalSeriesView = makeGetPersonalSeries(seriesDeps);
  const getPersonalEpisodeTrail = makeGetEpisodeTrail(seriesDeps);
  const buildPersonalRecap = makeBuildPersonalRecap({ series: personalSeriesRepository });
  const recapDeps = {
    recaps: recapRepository,
    awardXp,
    clock,
    ids,
    completedEpisodes: async (userId: string, pair: LanguagePair) => {
      const preferences = await identity.get(userId);
      const [progress, personal] = await Promise.all([
        catalog.listForUser(userId),
        getPersonalSeriesView({ userId, pair, userLevel: preferences?.level ?? "A1" }),
      ]);
      const finished = progress.filter((entry) => entry.progressPercent >= FULL_PERCENT);
      const contexts = await Promise.all(
        finished.map((entry) => catalog.findEpisodeContext(entry.episodeId)),
      );
      const catalogDone = finished.flatMap((entry, index) =>
        contexts[index]?.episode.subtitleLanguages.includes(pair.target)
          ? [{ source: "catalog" as const, episodeId: entry.episodeId }]
          : [],
      );
      const personalDone = personal.seasons.flatMap((season) =>
        season.episodes
          .filter((episode) => episode.cardCount > 0 && episode.progress >= FULL_PERCENT)
          .map((episode) => ({ source: "personal" as const, episodeId: episode.id })),
      );
      return [...catalogDone, ...personalDone];
    },
    describe: async (userId: string, pair: LanguagePair, source: RecapSource, episodeId: string) => {
      if (source === "catalog") {
        const context = await catalog.findEpisodeContext(episodeId);
        if (!context) return null;
        return {
          workTitle: context.media.title,
          label: {
            kind: "catalog" as const,
            mediaType: context.media.type,
            season: context.season.seasonNumber,
            episode: context.episode.episodeNumber,
          },
          title: context.episode.title,
          summary: context.episode.overview,
          cards: (await recapRepository.cardCueIds(userId, episodeId)).size,
        };
      }
      const trail = await getPersonalEpisodeTrail({ userId, pair, episodeId }).catch(() => null);
      if (!trail) return null;
      return {
        workTitle: trail.seriesName ?? "",
        label: { kind: "personal" as const, level: trail.season.level, episode: trail.episode.number },
        title: trail.episode.title,
        summary: "",
        cards: trail.episode.cardCount,
      };
    },
    material: async (input: {
      userId: string;
      pair: LanguagePair;
      level: CefrLevel;
      source: RecapSource;
      episodeId: string;
      seed: string;
    }) => {
      if (input.source === "personal") return buildPersonalRecap(input);
      const stored = await study.find(input.episodeId, input.pair, input.level);
      if (stored?.status !== "READY" || !stored.plan) return [];
      return pickRecapExercises({
        exercises: stored.plan.blocks.flatMap((block) => block.exercises),
        focusCueIds: await recapRepository.cardCueIds(input.userId, input.episodeId),
        seed: input.seed,
      });
    },
  };

  async function findCueInLanguage(cueId: string, language: StudyLanguage) {
    const cue = await subtitles.findCue(cueId);
    return cue && cue.language === language ? cue : null;
  }

  const findEpisodeLocation: FindEpisodeLocation = async (episodeId) => {
    const context = await catalog.findEpisodeContext(episodeId);
    if (!context) return null;
    return {
      episodeId,
      mediaId: context.media.id,
      mediaType: context.media.type,
      seasonNumber: context.season.seasonNumber,
    };
  };
  const audioMode: AudioMode = tts.name === "silent" ? "onDemand" : "queued";
  const importSubtitlesUseCase = makeImportEpisodeSubtitles({
    subtitles,
    storage,
    clock,
    ids,
    findEpisodeLocation,
  });
  const importEpisodeSubtitles = (input: Omit<Parameters<typeof importSubtitlesUseCase>[0], "audioMode">) =>
    importSubtitlesUseCase({ ...input, audioMode });
  async function listCuesInLanguage(episodeId: string, language: StudyLanguage) {
    const file = (await subtitles.listFiles(episodeId)).find((candidate) => candidate.language === language);
    return file ? subtitles.listCues(file.id) : null;
  }
  const scripts = new DrizzleScriptRepository(db);
  const importEpisodeScript = makeImportEpisodeScript({
    scripts,
    storage,
    clock,
    ids,
    findEpisodeLocation,
    loadCues: listCuesInLanguage,
  });
  const listScriptCompletions = makeListScriptCompletions({ scripts });
  const getScriptSummary = makeGetScriptSummary({ scripts });
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
      return platform.passwords.verify(password, record?.passwordHash ?? null);
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
    cipher: platform.personalCipher,
    account,
  };

  const generatePlan = makeGeneratePlan(studyDeps);
  const processCardBatch = makeProcessCardBatch({ learning, generate: generateCardDrafts, notify });
  const refreshRecommendations = makeRefreshRecommendations(recommendationDeps);
  const synthesizeLines = makeSynthesizeLines({ assets: audioAssets, storage, primary: tts, clock, ids });
  const audioBatchAvailable = tts.name !== "silent";
  const synthesizeEpisodeAudio = async (input: {
    userId: string;
    episodeId: string;
    language: StudyLanguage;
    voice: { voiceId: string; language: string };
    episodeLabel: string;
  }): Promise<void> => {
    const cues = await listCuesInLanguage(input.episodeId, input.language);
    if (!cues || cues.length === 0) return;
    const result = await synthesizeLines({ voice: input.voice, lines: cues });
    log.info("audio.batch", { episodeId: input.episodeId, ...result });
    if (result.generated === 0) return;
    await notify({
      userId: input.userId,
      kind: "audio_ready",
      params: { episode: input.episodeLabel, count: result.generated + result.cached },
      href: routes.read(input.episodeId),
    });
  };
  const synthesizeConversationAudio = async (input: {
    userId: string;
    sessionId: string;
    voice: { voiceId: string; language: string };
  }): Promise<void> => {
    if (!(await conversations.findSession(input.userId, input.sessionId))) return;
    const turns = await conversations.listTurns(input.sessionId);
    const result = await synthesizeLines({
      voice: input.voice,
      lines: turns.map((turn) => ({ id: turn.id, text: turn.correctedText ?? turn.text })),
    });
    log.info("audio.conversation", { sessionId: input.sessionId, ...result });
  };
  const refreshSeriesDescription = makeRefreshSeriesDescription(seriesDeps);
  const runConversationReview = makeRunConversationReview(conversationDeps);
  const jobs = new DrizzleJobRepository(db);
  const jobHandlers: JobHandlers = {
    generate_plan: generatePlan,
    card_batch: processCardBatch,
    refresh_recommendations: async (payload) => {
      await refreshRecommendations(payload);
    },
    episode_audio: synthesizeEpisodeAudio,
    conversation_review: async (payload) => {
      await runConversationReview(payload);
      if (!audioBatchAvailable) return;
      const preferences = await identity.get(payload.userId);
      if (!preferences) return;
      await synthesizeConversationAudio({
        userId: payload.userId,
        sessionId: payload.sessionId,
        voice: voiceFor(pairOf(preferences).target, preferences.preferredAccent),
      });
    },
    conversation_terms: makeRunTermCards(conversationDeps),
    conversation_audio: synthesizeConversationAudio,
    personal_series_description: async (payload) => {
      await refreshSeriesDescription({
        userId: payload.userId,
        pair: payload.pair,
        userLevel: payload.level,
      });
    },
    level_sources_sync: async (payload) => {
      const result = await syncLevelSources(payload);
      log.info("level_sources.synced", result);
    },
  };
  const runClaimedJob = makeRunClaimedJob({ jobs, handlers: jobHandlers, clock });
  const runJobInline = makeRunJobInline({ jobs, run: runClaimedJob, clock });
  const runNextJob = makeRunNextJob({ jobs, run: runClaimedJob, clock });

  return {
    providers: { metadata: defaultMetadata.name, tts: tts.name, subtitles: defaultSubtitleSource.name },
    jobsMode: env.JOBS_MODE,
    audioBatchAvailable,
    enqueueJob: makeEnqueueJob({ jobs, clock, ids }),
    runJobInline,
    runNextJob,
    hasPendingJob: makeHasPendingJob({ jobs }),
    importEpisodeScript,
    listScriptCompletions,
    getScriptSummary,
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
    listLevelSources: makeListLevelSources(levelSourceDeps),
    exportLevelRatings: makeExportLevelRatings(levelSourceDeps),
    browseWorks: async (userId: string, input: Parameters<ReturnType<typeof makeBrowseWorks>>[0]) =>
      (await catalogFor(userId)).browseWorks(input),
    rateWorkLevel: async (input: {
      actor: { userId: string; isAdmin: boolean };
      type: MediaType;
      externalId: string;
    }) => (await catalogFor(input.actor.userId)).rateWorkLevel(input),
    addLevelSource: makeAddLevelSource(levelSourceDeps),
    removeLevelSource: makeRemoveLevelSource(levelSourceDeps),
    setLevelSourceEnabled: makeSetLevelSourceEnabled(levelSourceDeps),
    getWorkLevelRatings: makeGetWorkLevelRatings(levelSourceDeps),
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
    generatePlan,
    savePlan: (input: Parameters<typeof study.saveReady>[0]) => study.saveReady(input),
    getTrail: makeGetTrail(studyDeps),
    getWorkTrail: makeGetWorkTrail(studyDeps),
    listRecaps: makeListRecaps(recapDeps),
    countDueRecaps: makeCountDueRecaps(recapDeps),
    startRecap: makeStartRecap(recapDeps),
    completeRecap: makeCompleteRecap(recapDeps),

    startConversation: makeStartConversation(conversationDeps),
    getConversation: makeGetConversation(conversationDeps),
    getLearnerProfile: makeGetLearnerProfile(conversationDeps),
    listConversations: makeListConversations(conversationDeps),
    sendMessage: makeSendMessage(conversationDeps),
    closeConversation: makeCloseConversation(conversationDeps),
    requestConversationReview: makeRequestConversationReview(conversationDeps),
    confirmConversationCards: makeConfirmConversationCards(conversationDeps),
    requestTermCards: makeRequestTermCards(conversationDeps),
    getPersonalSeries: getPersonalSeriesView,
    getPersonalEpisodeTrail,
    renamePersonalSeries: makeRenameSeries(seriesDeps),
    setPersonalSeriesLevel: makeSetSeriesLevel(seriesDeps),
    startPersonalLesson: makeStartPersonalLesson({ series: personalSeriesRepository, awardXp, clock, ids }),
    completePersonalLesson: makeCompletePersonalLesson({
      series: personalSeriesRepository,
      awardXp,
      clock,
      ids,
    }),
    getTurnSpeechText,
    isTutorSimulated: async (userId: string) => (await resolveTutor(userId)).name === "fake",
    startLesson: makeStartLesson(studyDeps),
    completeLesson: makeCompleteLesson(studyDeps),

    getReadingView: makeGetReadingView(highlightDeps),
    syncHighlights: makeSyncHighlights(highlightDeps),

    generateCardDrafts,
    requestCardDrafts: makeRequestCardDrafts({ learning, clock, ids }),
    processCardBatch,
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
    transcribeSpeech: makeTranscribeSpeech({ resolveTranscriber }),
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
    getAssignedModel,
    listModelAssignments: makeListModelAssignments({ choices: modelChoices }),
    assignAiModel: makeAssignAiModel({ choices: modelChoices, clock }),

    getRecommendations: makeGetRecommendations(recommendationDeps),
    refreshRecommendations,
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
      counts: gamification,
      clock,
    }),
    settleMissions: makeSettleMissions({ xp: gamification, counts: gamification, clock, ids }),
    awardXp,
  };
}

export type AppContainer = ReturnType<typeof buildAppContainer>;
