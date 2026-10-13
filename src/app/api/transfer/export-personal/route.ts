import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { isAppError } from "@/shared/errors";
import { getCurrentUser } from "../../../session";

const PASSWORD_ERROR_PATH = "/transfer?erro=senha#exportar";

const formSchema = z.object({
  password: z.string().min(1).max(200),
  includeCredentials: z.enum(["true", "false"]).default("false"),
});

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const form = await request.formData();
  const parsed = formSchema.safeParse({
    password: form.get("password"),
    includeCredentials: form.get("includeCredentials") || undefined,
  });
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const throttle = getContainer().loginThrottle;
  const throttleKey = user.email.trim().toLowerCase();
  if (throttle.isBlocked(throttleKey)) {
    return new NextResponse(null, { status: 303, headers: { location: PASSWORD_ERROR_PATH } });
  }
  try {
    const exported = await getContainer().exportPersonalPackage({
      userId: user.id,
      password: parsed.data.password,
      includeCredentials: parsed.data.includeCredentials === "true",
    });
    return new NextResponse(Buffer.from(exported.bytes), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${exported.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (isAppError(error) && error.code === "INVALID_CREDENTIALS") {
      throttle.recordFailure(throttleKey);
      return new NextResponse(null, { status: 303, headers: { location: PASSWORD_ERROR_PATH } });
    }
    if (isAppError(error)) return new NextResponse(null, { status: 400 });
    throw error;
  }
}
