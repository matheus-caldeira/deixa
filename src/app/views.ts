import { notFound, redirect } from "next/navigation";
import { execute, type AnyOperation } from "@/operations/operation";
import { OPERATIONS, type OperationName, type OperationOutput } from "@/operations/registry";
import { isAppError, type AppErrorCode } from "@/shared/errors";
import { operationContext } from "./operations";

const MISSING: readonly AppErrorCode[] = [
  "MEDIA_NOT_FOUND",
  "SEASON_NOT_FOUND",
  "EPISODE_NOT_FOUND",
  "CUE_NOT_FOUND",
  "ITEM_NOT_FOUND",
  "CARD_NOT_FOUND",
  "BATCH_NOT_FOUND",
];

export async function loadView<Name extends OperationName>(
  name: Name,
  input?: unknown,
): Promise<OperationOutput<Name>> {
  const definition: AnyOperation = OPERATIONS[name];
  try {
    return (await execute(definition, await operationContext(), input)) as OperationOutput<Name>;
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHENTICATED") redirect("/login");
    if (isAppError(error) && (MISSING.includes(error.code) || error.code === "INVALID_INPUT")) notFound();
    throw error;
  }
}
