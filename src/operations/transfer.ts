import { z } from "zod";
import { AppError } from "@/shared/errors";
import { operation } from "./operation";

const ORIGIN_THROTTLE_PREFIX = "personal-origin:";
const IMPORTER_THROTTLE_PREFIX = "personal-importer:";

export const transferOperations = {
  "transfer.importPackage": operation({
    input: z.object({ uploadId: z.uuid(), password: z.string().min(1).max(200).optional() }),
    refresh: true,
    run: async ({ user, app }, input) => {
      const throttle = app.loginThrottle;
      const originEmail = input.password
        ? await app.peekPersonalEmail({ userId: user.id, uploadId: input.uploadId })
        : null;
      const throttleKeys = originEmail
        ? [`${ORIGIN_THROTTLE_PREFIX}${originEmail}`, `${IMPORTER_THROTTLE_PREFIX}${user.id}`]
        : [];
      if (throttleKeys.some((key) => throttle.isBlocked(key))) {
        throw new AppError("INVALID_CREDENTIALS", "tooManyAttempts");
      }
      for (const key of throttleKeys) throttle.recordFailure(key);
      const report = await app.importPackage({
        userId: user.id,
        uploadId: input.uploadId,
        password: input.password,
      });
      for (const key of throttleKeys) throttle.reset(key);
      return report;
    },
  }),
};
