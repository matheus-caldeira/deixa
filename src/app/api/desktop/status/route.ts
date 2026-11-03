import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, type Locale } from "@/shared/locales";
import { getContainer } from "@/infrastructure/container";
import { verifyDesktopRequest } from "@/infrastructure/desktop";
import { getDatabaseStatus } from "@/infrastructure/setup";
import { DESKTOP_SIGNATURE_HEADER } from "@/shared/session-cookie";

const NOT_FOUND = 404;
const MAX_NOTIFICATIONS = 10;

export type DesktopStatus = {
  state: "setup" | "no-owner" | "ready";
  locale: Locale;
  owner: string | null;
  current: { title: string; label: string; progressPercent: number } | null;
  notifications: { id: string; title: string; body: string }[];
};

const reply = (status: DesktopStatus): NextResponse =>
  NextResponse.json(status, { headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest): Promise<NextResponse> {
  const signed = {
    method: "GET",
    path: "/api/desktop/status",
    signature: request.headers.get(DESKTOP_SIGNATURE_HEADER),
  };
  if (!verifyDesktopRequest(signed)) {
    return new NextResponse(null, { status: NOT_FOUND });
  }
  const empty = { locale: DEFAULT_LOCALE, owner: null, current: null, notifications: [] };
  if ((await getDatabaseStatus()).state !== "ready") return reply({ state: "setup", ...empty });
  const container = getContainer();
  const owner = await container.findOwner();
  if (!owner) return reply({ state: "no-owner", ...empty });
  const [overview, inbox, preferences] = await Promise.all([
    container.getCatalogOverview(owner.id),
    container.getInbox(owner.id),
    container.getPreferences(owner.id),
  ]);
  const latest =
    overview.inProgress.find((entry) => entry.episodeId === preferences?.currentEpisodeId) ??
    overview.inProgress.at(-1);
  const locale = preferences?.locale ?? DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: "inbox" });
  const errors = await getTranslations({ locale, namespace: "errors" });
  const describe = (item: (typeof inbox.items)[number]) => {
    const params = { ...item.params };
    if (typeof params.reason === "string") {
      params.reason = errors.has(params.reason) ? errors(params.reason) : errors("generic");
    }
    return {
      title: t.has(`${item.kind}.title`) ? t(`${item.kind}.title`, params) : item.kind,
      body: t.has(`${item.kind}.body`) ? t(`${item.kind}.body`, params) : "",
    };
  };
  return reply({
    state: "ready",
    locale,
    owner: owner.name,
    current: latest
      ? {
          title: latest.media.title,
          label: `${latest.label} · ${latest.episodeTitle}`,
          progressPercent: latest.progressPercent,
        }
      : null,
    notifications: inbox.items
      .slice(0, MAX_NOTIFICATIONS)
      .map((item) => ({ id: item.id, ...describe(item) })),
  });
}
