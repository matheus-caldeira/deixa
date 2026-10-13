import { NextResponse, type NextRequest } from "next/server";
import { isDesktopToken, issueEntryTicket } from "@/infrastructure/desktop";
import { DESKTOP_TOKEN_HEADER } from "@/shared/session-cookie";

const NOT_FOUND = 404;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isDesktopToken(request.headers.get(DESKTOP_TOKEN_HEADER))) {
    return new NextResponse(null, { status: NOT_FOUND });
  }
  return NextResponse.json({ ticket: issueEntryTicket() }, { headers: { "cache-control": "no-store" } });
}
