import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { logger } from "@/infrastructure/logger/logger";
import { isAppError } from "@/shared/errors";
import { getCurrentUser } from "../../session";

const NOT_FOUND_CODES = new Set(["CUE_NOT_FOUND", "ITEM_NOT_FOUND"]);

export async function respondWithSpeech(
  id: string,
  resolveText: (userId: string, id: string) => Promise<string>,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  try {
    const text = await resolveText(user.id, id);
    const audio = await getContainer().getSpeechAudio({
      userId: user.id,
      text,
      accent: user.preferences.preferredAccent,
    });
    return new Response(Buffer.from(audio.bytes), {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "cache-control": "private, max-age=3600",
        "x-audio-cache": audio.cache,
        "x-audio-provider": audio.provider,
      },
    });
  } catch (error) {
    if (isAppError(error) && NOT_FOUND_CODES.has(error.code)) return new Response(null, { status: 404 });
    if (isAppError(error) && error.code === "AUDIO_BUSY") return new Response(null, { status: 429 });
    logger.error("audio.failed", { reason: error instanceof Error ? error.message : "desconhecido" });
    return new Response(null, { status: 503 });
  }
}
