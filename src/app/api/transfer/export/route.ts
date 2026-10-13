import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { exportRequestSchema } from "@/modules/packages";
import { isAppError } from "@/shared/errors";
import { getCurrentUser } from "../../../session";

function parseScope(params: URLSearchParams): unknown {
  const kind = params.get("kind");
  const mediaId = params.get("mediaId");
  const scope =
    kind === "season"
      ? { kind, mediaId, seasonNumber: Number(params.get("seasonNumber")) }
      : kind === "episode"
        ? { kind, mediaId, episodeId: params.get("episodeId") }
        : { kind: "work", mediaId };
  const flag = (name: string) => params.get(name) === "1";
  return { scope, options: { subtitles: flag("subtitles"), cards: flag("cards"), audio: flag("audio") } };
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const parsed = exportRequestSchema.safeParse(parseScope(request.nextUrl.searchParams));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  try {
    const exported = await getContainer().exportPackage(parsed.data);
    return new NextResponse(Buffer.from(exported.bytes), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${exported.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error)) return new NextResponse(null, { status: 404 });
    throw error;
  }
}
