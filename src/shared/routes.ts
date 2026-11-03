export const PERSONAL_TRAIL_ID = "personal";

type Query = Record<string, string | number | null | undefined>;

function withQuery(path: string, query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const routes = {
  catalog: () => "/catalog",
  work: (mediaId: string, season?: number | null) => withQuery("/catalog/work", { id: mediaId, season }),
  trail: (mediaId: string, season?: number | string | null) => withQuery("/trail", { id: mediaId, season }),
  personalTrail: (level?: string | null) => withQuery("/trail", { id: PERSONAL_TRAIL_ID, season: level }),
  read: (episodeId: string, batch?: string) => withQuery("/read", { id: episodeId, batch }),
  study: (episodeId: string, node: number | string) => withQuery("/study", { id: episodeId, node }),
  recap: (recapId: string) => withQuery("/recap", { id: recapId }),
  personalEpisode: (episodeId: string) => withQuery("/series/episode", { id: episodeId }),
  personalLesson: (episodeId: string, node: number | string) =>
    withQuery("/series/lesson", { id: episodeId, node }),
  conversation: (sessionId: string) => withQuery("/tutor/chat", { id: sessionId }),
  conversationReview: (sessionId: string) => withQuery("/tutor/review", { id: sessionId }),
};

export const LEGACY_ROUTES = [
  { source: "/catalog/:id((?!work$|tmdb$)[^/]+)", destination: "/catalog/work?id=:id" },
  { source: "/trail/:id", destination: "/trail?id=:id" },
  { source: "/read/:id", destination: "/read?id=:id" },
  { source: "/study/:id/:node", destination: "/study?id=:id&node=:node" },
  { source: "/recap/:id", destination: "/recap?id=:id" },
  {
    source: "/series/:id((?!episode$|lesson$)[^/]+)/lesson/:node",
    destination: "/series/lesson?id=:id&node=:node",
  },
  { source: "/series/:id((?!episode$|lesson$)[^/]+)", destination: "/series/episode?id=:id" },
  { source: "/tutor/:id((?!chat$|review$)[^/]+)/review", destination: "/tutor/review?id=:id" },
  { source: "/tutor/:id((?!chat$|review$)[^/]+)", destination: "/tutor/chat?id=:id" },
];
