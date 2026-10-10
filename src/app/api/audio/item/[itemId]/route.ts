import { getContainer } from "@/infrastructure/container";
import { respondWithSpeech } from "../../respond";

export async function GET(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
): Promise<Response> {
  const { itemId } = await context.params;
  return respondWithSpeech(itemId, (userId, id) => getContainer().getSpeakableItemText(userId, id));
}
