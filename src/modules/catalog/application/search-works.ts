import type { CatalogRepository, MetadataProvider, WorkSummary } from "./ports";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

export type WorkSearchResult = WorkSummary & { catalogMediaId: string | null };

export function makeSearchWorks(deps: { catalog: CatalogRepository; metadata: MetadataProvider }) {
  return async function searchWorks(query: string): Promise<WorkSearchResult[]> {
    const cleaned = query.trim();
    if (cleaned.length < MIN_QUERY_LENGTH) return [];
    const found = (await deps.metadata.searchWorks(cleaned)).slice(0, MAX_RESULTS);
    return Promise.all(
      found.map(async (work) => ({
        ...work,
        catalogMediaId: (await deps.catalog.findMediaByExternal(work.provider, work.externalId))?.id ?? null,
      })),
    );
  };
}
