import { NextResponse, type NextRequest } from "next/server";
import { proveDesktopPeer } from "@/infrastructure/desktop";

const NOT_FOUND = 404;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const proof = proveDesktopPeer(request.nextUrl.searchParams.get("nonce"));
  if (!proof) return new NextResponse(null, { status: NOT_FOUND });
  return NextResponse.json({ proof }, { headers: { "cache-control": "no-store" } });
}
