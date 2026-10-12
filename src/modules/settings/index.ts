export {
  MAX_DAILY_DOWNLOADS,
  appSettingsSchema,
  mergeSettings,
  type AppSettings,
  type SettingKey,
} from "./domain/settings";
export {
  makeGetSettings,
  makeUpdateSettings,
  type SettingsRepository,
} from "./application/settings-use-cases";
