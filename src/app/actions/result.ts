import { isAppError, type AppErrorCode } from "@/shared/errors";
import { unstable_rethrow } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { logger } from "@/infrastructure/logger/logger";

export type ActionResult<Data> =
  { ok: true; data: Data } | { ok: false; message: string; code?: AppErrorCode };

const MESSAGES: Partial<Record<AppErrorCode, string>> = {
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  EMAIL_TAKEN: "Já existe uma conta com esse e-mail.",
  INVALID_INPUT: "Confira os dados informados.",
  UNAUTHENTICATED: "Sua sessão terminou. Entre de novo.",
  FORBIDDEN: "Você não tem permissão para fazer isso.",
  MEDIA_NOT_FOUND: "Não encontramos essa obra.",
  SEASON_NOT_FOUND: "Não encontramos essa temporada.",
  EPISODE_NOT_FOUND: "Não encontramos esse episódio.",
  EPISODE_NOT_READY: "Esse episódio ainda não tem legenda pronta.",
  CUE_NOT_FOUND: "Não encontramos essa fala.",
  CARD_NOT_FOUND: "Não encontramos esse cartão.",
  BATCH_NOT_FOUND: "Esses cards já foram salvos ou expiraram. Gere de novo.",
  NO_HIGHLIGHTS: "Marque alguma palavra ou fala antes de gerar os cards.",
  METADATA_UNAVAILABLE: "A busca de obras está fora do ar. Tente de novo ou cadastre manualmente.",
  METADATA_UNAUTHORIZED: "A busca de obras está sem credencial válida. Cadastre manualmente por enquanto.",
  METADATA_NOT_FOUND: "Não encontramos essa obra na busca.",
  LLM_FAILED: "A IA não respondeu. Tente de novo em instantes.",
  LLM_INVALID_OUTPUT: "A IA devolveu uma resposta fora do formato. Tente de novo.",
  AI_LIMIT_REACHED: "Você chegou ao limite de uso da IA. Ler, marcar e revisar continuam funcionando.",
  SUBTITLE_SOURCE_QUOTA: "A cota de downloads de hoje acabou. Envie o arquivo manualmente ou tente depois.",
  SUBTITLE_SOURCE_UNAVAILABLE: "A busca de legendas está fora do ar. Envie o arquivo manualmente.",
  SUBTITLE_SOURCE_EMPTY: "Não encontramos legendas para este episódio. Envie o arquivo manualmente.",
  AUDIO_BUSY: "Já estamos gerando outros áudios para você. Tente de novo em instantes.",
};
const GENERIC = "Algo deu errado. Tente de novo.";

export async function runAction<Data>(name: string, work: () => Promise<Data>): Promise<ActionResult<Data>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    if (isAppError(error)) {
      const custom = error.message !== error.code ? error.message : undefined;
      return { ok: false, code: error.code, message: custom ?? MESSAGES[error.code] ?? GENERIC };
    }
    logger.error("action.failed", {
      action: name,
      reason: error instanceof Error ? error.message : "desconhecido",
    });
    return { ok: false, message: GENERIC };
  }
}

export const app = getContainer;
