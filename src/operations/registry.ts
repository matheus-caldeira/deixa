import { aiSettingsOperations } from "./ai-settings";
import { catalogOperations } from "./catalog";
import { levelSourceOperations } from "./level-sources";
import { notificationOperations } from "./notifications";
import { personalSeriesOperations } from "./personal-series";
import { profileOperations } from "./profile";
import { readingOperations } from "./reading";
import { recommendationOperations } from "./recommendations";
import { reviewOperations } from "./review";
import { studyOperations } from "./study";
import { transferOperations } from "./transfer";
import { tutorOperations } from "./tutor";

export const OPERATIONS = {
  ...aiSettingsOperations,
  ...catalogOperations,
  ...levelSourceOperations,
  ...notificationOperations,
  ...personalSeriesOperations,
  ...profileOperations,
  ...readingOperations,
  ...recommendationOperations,
  ...reviewOperations,
  ...studyOperations,
  ...transferOperations,
  ...tutorOperations,
};

export type Operations = typeof OPERATIONS;
export type OperationName = keyof Operations;
export type OperationOutput<Name extends OperationName> = Operations[Name] extends {
  run: (...args: never[]) => Promise<infer Output>;
}
  ? Output
  : never;
