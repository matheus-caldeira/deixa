import { NextResponse, type NextRequest } from "next/server";
import { verifyDesktopRequest, issueEntryTicket } from "@/infrastructure/desktop";
import { DESKTOP_SIGNATURE_HEADER } from "@/shared/session-cookie";

const NOT_FOUND = 404;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signed = {
    method: "POST",
    path: "/api/desktop/ticket",
    signature: request.headers.get(DESKTOP_SIGNATURE_HEADER),
  };
  if (!verifyDesktopRequest(signed)) {
    return new NextResponse(null, { status: NOT_FOUND });
  }
  return NextResponse.json({ ticket: issueEntryTicket() }, { headers: { "cache-control": "no-store" } });
}
