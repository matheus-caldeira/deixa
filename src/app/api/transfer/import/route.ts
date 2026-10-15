import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { describeAppError } from "@/app/actions/result";
import { getContainer } from "@/infrastructure/container";
import { MAX_PACKAGE_BYTES } from "@/modules/packages";
import { isAppError } from "@/shared/errors";
import { getCurrentUser } from "../../../session";

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const t = await getTranslations("errors.detail");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: t("chooseZip") }, { status: 400 });
  }
  if (file.size > MAX_PACKAGE_BYTES) {
    return NextResponse.json({ ok: false, message: t("packageTooLarge", { gb: 1 }) }, { status: 413 });
  }
  try {
    const preview = await getContainer().inspectPackage({
      userId: user.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true, data: preview });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ ok: false, message: await describeAppError(error) }, { status: 400 });
    }
    throw error;
  }
}
