import { z } from "zod";
import { exportRequestSchema } from "@/modules/packages";
import { AppError } from "@/shared/errors";
import { operation } from "./operation";

const ORIGIN_THROTTLE_PREFIX = "personal-origin:";
const IMPORTER_THROTTLE_PREFIX = "personal-importer:";

const MAX_PACKAGE_BYTES = 1024 * 1024 * 1024;

export const transferOperations = {
  "transfer.export": operation({
    input: exportRequestSchema,
    run: ({ app }, input) => app.exportPackage(input),
  }),
  "transfer.exportPersonal": operation({
    input: z.object({ password: z.string().min(1).max(200), includeCredentials: z.boolean() }),
    run: ({ user, app }, input) => app.exportPersonalPackage({ userId: user.id, ...input }),
  }),
  "transfer.inspect": operation({
    input: z.object({ bytes: z.instanceof(Uint8Array) }),
    run: ({ user, app }, { bytes }) => {
      if (bytes.byteLength === 0) throw new AppError("INVALID_INPUT", "chooseZip");
      if (bytes.byteLength > MAX_PACKAGE_BYTES)
        throw new AppError("INVALID_INPUT", { key: "packageTooLarge", params: { gb: 1 } });
      return app.inspectPackage({ userId: user.id, bytes });
    },
  }),
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
