import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { verifyDesktopRequest } from "@/infrastructure/desktop";
import { getDatabaseStatus } from "@/infrastructure/setup";
import { DESKTOP_SIGNATURE_HEADER } from "@/shared/session-cookie";

const NOT_FOUND = 404;
const MAX_NOTIFICATIONS = 10;

export type DesktopStatus = {
  state: "setup" | "no-owner" | "ready";
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
  const empty = { owner: null, current: null, notifications: [] };
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
  return reply({
    state: "ready",
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
      .map((item) => ({ id: item.id, title: item.title, body: item.body })),
  });
}
