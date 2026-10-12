import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDatabaseStatus, verifySetupCode } from "@/infrastructure/setup";
import { SETUP_COOKIE } from "@/shared/session-cookie";

const ONE_HOUR_SECONDS = 3600;
const MAX_CODE_CHARS = 40;
const TEMPORARY_REDIRECT = 307;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const back = () => new NextResponse(null, { status: TEMPORARY_REDIRECT, headers: { location: "/setup" } });
  const code = request.nextUrl.searchParams.get("code")?.slice(0, MAX_CODE_CHARS);
  if ((await getDatabaseStatus()).state === "ready" || !(await verifySetupCode(code))) {
    return back();
  }
  (await cookies()).set(SETUP_COOKIE, code ?? "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: ONE_HOUR_SECONDS,
  });
  return back();
}
