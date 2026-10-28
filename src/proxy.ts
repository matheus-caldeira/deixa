import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/shared/session-cookie";

const PUBLIC_PATHS = [
  "/setup",
  "/desktop/enter",
  "/api/desktop",
  "/login",
  "/signup",
  "/privacy",
  "/manifest.webmanifest",
  "/pwa-icon",
  "/sw.js",
  "/offline.html",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return new NextResponse(null, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
