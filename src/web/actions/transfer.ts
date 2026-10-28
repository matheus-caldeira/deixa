import { callAction } from "../call";

export async function importPackageAction(input: unknown) {
  return callAction("transfer.importPackage", input);
}
