import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { redeemEntryTicket } from "@/infrastructure/desktop";
import { getDatabaseStatus } from "@/infrastructure/setup";
import { getCurrentUser, startSession } from "../../session";

const TEMPORARY_REDIRECT = 307;
const MAX_TICKET_CHARS = 200;

const goTo = (location: string): NextResponse =>
  new NextResponse(null, { status: TEMPORARY_REDIRECT, headers: { location } });

export async function GET(request: NextRequest): Promise<NextResponse> {
  if ((await getDatabaseStatus()).state !== "ready") return goTo("/setup");
  const ticket = request.nextUrl.searchParams.get("ticket")?.slice(0, MAX_TICKET_CHARS);
  if (!redeemEntryTicket(ticket)) return goTo("/login");
  if (await getCurrentUser()) return goTo("/");
  const session = await getContainer().startOwnerSession();
  if (!session) return goTo("/signup");
  await startSession(session.token, session.expiresAt);
  return goTo("/");
}
