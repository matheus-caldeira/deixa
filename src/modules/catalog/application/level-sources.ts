import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import {
  MAX_LEVEL_SOURCES,
  MAX_LEVEL_SOURCE_DEPTH,
  aggregateLevelRanges,
  isLevelSourceUrl,
  parseLevelSourceDocument,
  sameRange,
  type LevelRange,
  type LevelSourceStatus,
} from "../domain/level-ratings";
import type { CatalogRepository } from "./ports";

export const LEVEL_FETCH_FAILURES = [
  "unreachable",
  "timeout",
  "status",
  "tooLarge",
  "notJson",
  "invalid",
] as const;
export type LevelFetchFailure = (typeof LEVEL_FETCH_FAILURES)[number];

export type LevelSource = {
  id: string;
  url: string;
  name: string | null;
  parentId: string | null;
  enabled: boolean;
  status: LevelSourceStatus;
  ratingCount: number;
  rejectedCount: number;
  lastError: LevelFetchFailure | null;
  lastStatus: number | null;
  fetchedAt: Date | null;
  createdAt: Date;
};

export type LevelRating = { sourceId: string | null; sourceName: string | null; range: LevelRange };

export interface LevelSourceRepository {
  list(): Promise<LevelSource[]>;
  find(id: string): Promise<LevelSource | null>;
  findByUrl(url: string): Promise<LevelSource | null>;
  add(input: {
    id: string;
    url: string;
    parentId: string | null;
    createdBy: string | null;
    now: Date;
  }): Promise<void>;
  remove(id: string): Promise<void>;
  removeChildrenExcept(parentId: string, urls: readonly string[]): Promise<void>;
  setEnabled(id: string, enabled: boolean, now: Date): Promise<void>;
  saveRatings(
    id: string,
    result: { name: string | null; ratings: ReadonlyMap<string, LevelRange>; rejected: number; now: Date },
  ): Promise<void>;
  saveFailure(
    id: string,
    failure: { reason: LevelFetchFailure; status: number | null; now: Date },
  ): Promise<void>;
  ratingsFor(externalIds: readonly string[]): Promise<Map<string, LevelRating[]>>;
}

export type LevelFetchResult =
  { ok: true; data: unknown } | { ok: false; reason: LevelFetchFailure; status: number | null };

export interface LevelSourceFetcher {
  fetchJson(url: string): Promise<LevelFetchResult>;
}

export type BuiltinLevelGuide = {
  count: number;
  rangeOf(externalId: string): LevelRange | null;
};

type Actor = { userId: string; isAdmin: boolean };

type Deps = {
  sources: LevelSourceRepository;
  fetcher: LevelSourceFetcher;
  builtin: BuiltinLevelGuide;
  catalog: CatalogRepository;
  clock: Clock;
  ids: IdGenerator;
};

const TMDB = "tmdb";

function requireAdmin(actor: Actor): void {
  if (!actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlyLevelSources");
}

export type WorkLevelRatings = { range: LevelRange | null; ratings: LevelRating[] };

export function makeResolveLevelRatings(deps: Pick<Deps, "sources" | "builtin">) {
  return async function resolveLevelRatings(
    externalIds: readonly string[],
  ): Promise<Map<string, WorkLevelRatings>> {
    const unique = [...new Set(externalIds)];
    const stored =
      unique.length > 0 ? await deps.sources.ratingsFor(unique) : new Map<string, LevelRating[]>();
    const resolved = new Map<string, WorkLevelRatings>();
    for (const externalId of unique) {
      const builtin = deps.builtin.rangeOf(externalId);
      const ratings = [
        ...(builtin ? [{ sourceId: null, sourceName: null, range: builtin }] : []),
        ...(stored.get(externalId) ?? []),
      ];
      if (ratings.length === 0) continue;
      resolved.set(externalId, {
        range: aggregateLevelRanges(ratings.map((rating) => rating.range)),
        ratings,
      });
    }
    return resolved;
  };
}

export function makeListLevelSources(deps: Pick<Deps, "sources" | "builtin">) {
  return async function listLevelSources(input: { actor: Actor }) {
    requireAdmin(input.actor);
    return { builtinCount: deps.builtin.count, sources: await deps.sources.list() };
  };
}

export function makeAddLevelSource(deps: Pick<Deps, "sources" | "clock" | "ids">) {
  return async function addLevelSource(input: { actor: Actor; url: string }): Promise<{ sourceId: string }> {
    requireAdmin(input.actor);
    const url = input.url.trim();
    if (!isLevelSourceUrl(url)) throw new AppError("INVALID_INPUT", "levelSourceUrlInvalid");
    if (await deps.sources.findByUrl(url)) throw new AppError("INVALID_INPUT", "levelSourceExists");
    if ((await deps.sources.list()).length >= MAX_LEVEL_SOURCES) {
      throw new AppError("INVALID_INPUT", { key: "levelSourceLimit", params: { limit: MAX_LEVEL_SOURCES } });
    }
    const sourceId = deps.ids.next();
    await deps.sources.add({
      id: sourceId,
      url,
      parentId: null,
      createdBy: input.actor.userId,
      now: deps.clock.now(),
    });
    return { sourceId };
  };
}

async function findOwned(deps: Pick<Deps, "sources">, sourceId: string): Promise<LevelSource> {
  const source = await deps.sources.find(sourceId);
  if (!source) throw new AppError("ITEM_NOT_FOUND");
  return source;
}

export function makeRecomputeCatalogLevels(deps: Pick<Deps, "sources" | "builtin" | "catalog">) {
  const resolve = makeResolveLevelRatings(deps);
  return async function recomputeCatalogLevels(): Promise<{ updated: number }> {
    const media = (await deps.catalog.listCatalog())
      .map((entry) => entry.media)
      .filter((item) => item.metadataProvider === TMDB);
    const resolved = await resolve(media.map((item) => item.externalId));
    let updated = 0;
    for (const item of media) {
      const range = resolved.get(item.externalId)?.range;
      if (!range || sameRange(range, [item.levelMin, item.levelMax])) continue;
      await deps.catalog.updateLevelRange(item.id, range);
      updated += 1;
    }
    return { updated };
  };
}

export function makeRemoveLevelSource(deps: Pick<Deps, "sources" | "builtin" | "catalog">) {
  const recompute = makeRecomputeCatalogLevels(deps);
  return async function removeLevelSource(input: { actor: Actor; sourceId: string }): Promise<void> {
    requireAdmin(input.actor);
    const source = await findOwned(deps, input.sourceId);
    if (source.parentId) throw new AppError("INVALID_INPUT", "levelSourceChild");
    await deps.sources.remove(source.id);
    await recompute();
  };
}

export function makeSetLevelSourceEnabled(deps: Pick<Deps, "sources" | "builtin" | "catalog" | "clock">) {
  const recompute = makeRecomputeCatalogLevels(deps);
  return async function setLevelSourceEnabled(input: {
    actor: Actor;
    sourceId: string;
    enabled: boolean;
  }): Promise<void> {
    requireAdmin(input.actor);
    const source = await findOwned(deps, input.sourceId);
    const all = await deps.sources.list();
    const affected = new Set([source.id]);
    for (let depth = 0; depth < MAX_LEVEL_SOURCE_DEPTH; depth += 1) {
      for (const candidate of all)
        if (candidate.parentId && affected.has(candidate.parentId)) affected.add(candidate.id);
    }
    const now = deps.clock.now();
    for (const id of affected) await deps.sources.setEnabled(id, input.enabled, now);
    await recompute();
  };
}

export function makeSyncLevelSources(deps: Deps) {
  const recompute = makeRecomputeCatalogLevels(deps);
  return async function syncLevelSources(input: { sourceId: string | null }) {
    const known = await deps.sources.list();
    const roots = known.filter(
      (source) => source.parentId === null && (input.sourceId === null || source.id === input.sourceId),
    );
    const queue = roots.map((source) => ({ source, depth: 0 }));
    const visited = new Set<string>();
    let fetched = 0;
    let failed = 0;
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next || visited.has(next.source.url)) continue;
      visited.add(next.source.url);
      if (!next.source.enabled) continue;
      const now = deps.clock.now();
      const result = await deps.fetcher.fetchJson(next.source.url);
      const document = result.ok ? parseLevelSourceDocument(result.data) : null;
      if (!result.ok || !document) {
        failed += 1;
        await deps.sources.saveFailure(next.source.id, {
          reason: result.ok ? "invalid" : result.reason,
          status: result.ok ? null : result.status,
          now,
        });
        continue;
      }
      fetched += 1;
      await deps.sources.saveRatings(next.source.id, {
        name: document.name,
        ratings: document.ratings,
        rejected: document.rejected,
        now,
      });
      const childDepth = next.depth + 1;
      const childUrls = childDepth <= MAX_LEVEL_SOURCE_DEPTH ? document.sources : [];
      await deps.sources.removeChildrenExcept(next.source.id, childUrls);
      for (const url of childUrls) {
        if (visited.has(url)) continue;
        const existing = await deps.sources.findByUrl(url);
        if (existing && existing.parentId !== next.source.id) continue;
        if (!existing && (await deps.sources.list()).length >= MAX_LEVEL_SOURCES) break;
        let child = existing;
        if (!child) {
          const id = deps.ids.next();
          await deps.sources.add({ id, url, parentId: next.source.id, createdBy: null, now });
          child = await deps.sources.find(id);
        }
        if (child) queue.push({ source: child, depth: childDepth });
      }
    }
    const { updated } = await recompute();
    return { fetched, failed, updated };
  };
}

export function makeGetWorkLevelRatings(deps: Pick<Deps, "sources" | "builtin" | "catalog">) {
  const resolve = makeResolveLevelRatings(deps);
  return async function getWorkLevelRatings(input: { mediaId: string }): Promise<WorkLevelRatings> {
    const media = await deps.catalog.findMediaById(input.mediaId);
    if (!media) throw new AppError("MEDIA_NOT_FOUND");
    if (media.metadataProvider !== TMDB) return { range: null, ratings: [] };
    return (await resolve([media.externalId])).get(media.externalId) ?? { range: null, ratings: [] };
  };
}
