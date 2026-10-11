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
  makeGetCardBatch,
  makeGetSpeakableItemText,
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
import { makeGetEpisodeScript, makeImportEpisodeSubtitles } from "@/modules/subtitles";
import { DrizzleSubtitleRepository } from "@/modules/subtitles/infrastructure/drizzle-subtitle-repository";
import { systemClock, type Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { uuidGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { tokenize } from "@/shared/text";
import { getEnv, hasTmdbCredentials, type Env } from "./config/env";
import { openDatabase, type Database } from "./database/client";
import { GeminiLessonPlanner } from "./google-ai/gemini-lesson-planner";
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
  plannerForUser?: (userId: string) => Promise<LessonPlanner | null>;
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
  const study = new DrizzleStudyRepository(db);
  const notificationRepository = new DrizzleNotificationRepository(db);
  const notify = makeNotify({ notifications: notificationRepository, clock, ids });

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
      const key = apiKey ?? env.GEMINI_API_KEY;
      return key ? new GeminiLlmProvider(key, env.GEMINI_MODEL) : fakeLlm;
    });
  const resolvePlanner =
    options.plannerForUser ??
    (async (userId: string): Promise<LessonPlanner | null> => {
      const key = env.GEMINI_API_KEY ?? (await resolveApiKey(userId));
      return key ? new GeminiLessonPlanner(key, env.GEMINI_MODEL) : null;
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

  const generateCardDrafts = makeGenerateCardDrafts(learningDeps);

  async function loadTrailLines(episodeId: string): Promise<TrailLine[] | null> {
    const script = await getEpisodeScript(episodeId);
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
    items: { cueId: string; translation: string | null }[],
  ): Promise<number> {
    const script = await getEpisodeScript(episodeId);
    if (!script) return 0;
    const reusable = new Map(
      (await learning.findReusable(userId, episodeId)).map((item) => [
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

    ensurePlan: makeEnsurePlan(studyDeps),
    generatePlan: makeGeneratePlan(studyDeps),
    savePlan: (input: Parameters<typeof study.saveReady>[0]) => study.saveReady(input),
    getTrail: makeGetTrail(studyDeps),
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
    getAnticipationStatus: makeGetAnticipationStatus({ cards, clock }),
    anticipateReview: makeAnticipateReview({ cards, clock, ids }),
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

const globalStore = globalThis as typeof globalThis & { __deixaDatabase?: Database };
let container: Container | undefined;

export function getContainer(): Container {
  if (!container) {
    const env = getEnv();
    globalStore.__deixaDatabase ??= openDatabase(env.DATABASE_URL).db;
    container = buildContainer({ env, db: globalStore.__deixaDatabase });
  }
  return container;
}
