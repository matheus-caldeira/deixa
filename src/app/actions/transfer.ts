"use server";

import { runOperation } from "../operations";

export async function importPackageAction(input: unknown) {
  return runOperation("transfer.importPackage", input);
}
