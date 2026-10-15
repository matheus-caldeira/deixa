import { getContainer } from "@/infrastructure/container";
import { respondWithSpeech } from "../../respond";

export async function GET(
  _request: Request,
  context: { params: Promise<{ turnId: string }> },
): Promise<Response> {
  const { turnId } = await context.params;
  return respondWithSpeech(turnId, (userId, id) => getContainer().getTurnSpeech(userId, id));
}
