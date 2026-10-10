import { getContainer } from "@/infrastructure/container";
import { respondWithSpeech } from "../../respond";

export async function GET(
  _request: Request,
  context: { params: Promise<{ cueId: string }> },
): Promise<Response> {
  const { cueId } = await context.params;
  return respondWithSpeech(cueId, (_userId, id) => getContainer().getCueSpeechText(id));
}
