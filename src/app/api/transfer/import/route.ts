import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { MAX_PACKAGE_BYTES } from "@/modules/packages";
import { isAppError } from "@/shared/errors";
import { getCurrentUser } from "../../../session";

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: "Escolha um arquivo .deixa.zip." }, { status: 400 });
  }
  if (file.size > MAX_PACKAGE_BYTES) {
    return NextResponse.json(
      { ok: false, message: "O arquivo passa do tamanho máximo de 1 GB." },
      { status: 413 },
    );
  }
  try {
    const preview = await getContainer().inspectPackage({
      userId: user.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true, data: preview });
  } catch (error) {
    if (isAppError(error)) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    throw error;
  }
}
