import type { SetupCodeGate } from "@/modules/identity";
import { clearSetupCode, configDirectory, matchesSetupCode } from "./local-config";

export const WRONG_SETUP_CODE_DELAY_MS = 1000;

export function fileSetupCodeGate(directory: () => string = configDirectory): SetupCodeGate {
  return {
    matches: async (candidate) => {
      if (matchesSetupCode(directory(), candidate)) return true;
      await new Promise((resolve) => setTimeout(resolve, WRONG_SETUP_CODE_DELAY_MS));
      return false;
    },
    consume: async () => clearSetupCode(directory()),
  };
}
