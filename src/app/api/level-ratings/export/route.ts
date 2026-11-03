import { NextResponse } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { levelRatingsFile } from "@/modules/catalog";
import { APP_NAME } from "@/shared/app";
import { getCurrentUser } from "../../../session";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const file = levelRatingsFile(await getContainer().exportLevelRatings({ name: APP_NAME }));
  return new NextResponse(file.contents, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${file.filename}"`,
      "cache-control": "no-store",
    },
  });
}
