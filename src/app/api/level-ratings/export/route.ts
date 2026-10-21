import { NextResponse } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { APP_NAME } from "@/shared/app";
import { getCurrentUser } from "../../../session";

const FILENAME_DATE_LENGTH = 10;

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const exported = await getContainer().exportLevelRatings({ name: APP_NAME });
  const day = exported.exportedAt.slice(0, FILENAME_DATE_LENGTH);
  return new NextResponse(`${JSON.stringify(exported, null, 2)}\n`, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${APP_NAME.toLowerCase()}-niveis-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
