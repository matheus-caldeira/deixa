import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDatabaseStatus, prepareFirstAccountCode, verifySetupCode } from "@/infrastructure/setup";
import { SETUP_COOKIE } from "@/shared/session-cookie";

const ONE_HOUR_SECONDS = 3600;
const MAX_CODE_CHARS = 40;
const TEMPORARY_REDIRECT = 307;

function redirectTo(location: "/setup" | "/signup" | "/login"): NextResponse {
  return new NextResponse(null, { status: TEMPORARY_REDIRECT, headers: { location } });
}

async function nextStep(): Promise<"/setup" | "/signup" | "/login"> {
  if ((await getDatabaseStatus()).state !== "ready") return "/setup";
  return (await prepareFirstAccountCode()) ? "/signup" : "/login";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code")?.slice(0, MAX_CODE_CHARS);
  const next = await nextStep();
  if (next === "/login" || !(await verifySetupCode(code))) return redirectTo(next);
  (await cookies()).set(SETUP_COOKIE, code ?? "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: ONE_HOUR_SECONDS,
  });
  return redirectTo(next);
}
