import { readFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getContainer, refreshSettings } from "@/infrastructure/container";
import { execute, type AnyOperation, type OperationContext } from "@/operations/operation";
import { OPERATIONS, type OperationName, type OperationOutput } from "@/operations/registry";
import type { StudyLanguage } from "@/shared/study-languages";
import { runAction, type ActionResult } from "./actions/result";
import { scheduleJob } from "./schedule";
import { requireUser } from "./session";

const SAMPLES_DIR = "fixtures";

async function readSample(language: StudyLanguage) {
  const filename = `sample.${language}.srt`;
  return { filename, bytes: new Uint8Array(await readFile(`${SAMPLES_DIR}/${filename}`)) };
}

export async function operationContext(): Promise<OperationContext> {
  const user = await requireUser();
  const app = getContainer();
  return {
    user,
    app,
    schedule: (kind, payload) => scheduleJob(app, kind, payload, user.id),
    refreshSettings,
    readSample,
    translator: async (namespace) => {
      const t = await getTranslations(namespace);
      return (key, params) => t(key, params);
    },
  };
}

export async function runOperation<Name extends OperationName>(
  name: Name,
  input?: unknown,
): Promise<ActionResult<OperationOutput<Name>>> {
  const context = await operationContext();
  const definition: AnyOperation = OPERATIONS[name];
  return runAction(name, async () => {
    const output = (await execute(definition, context, input)) as OperationOutput<Name>;
    if (definition.refresh) revalidatePath("/", "layout");
    return output;
  });
}
