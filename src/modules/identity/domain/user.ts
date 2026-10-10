import type { CefrLevel } from "@/shared/levels";

export type Accent = "US" | "UK";

export const DAILY_GOALS = [
  { xp: 50, label: "Leve" },
  { xp: 100, label: "Regular" },
  { xp: 150, label: "Firme" },
  { xp: 250, label: "Intenso" },
] as const;

export const AUDIO_SPEEDS = [0.8, 1, 1.15] as const;
export const AVATAR_COLORS = ["#E0533D", "#2F43D6", "#0F9E73"] as const;
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const MIN_PASSWORD_LENGTH = 8;

export type Preferences = {
  level: CefrLevel;
  nativeLanguage: string;
  dailyGoal: number;
  preferredAccent: Accent;
  audioSpeed: number;
  timezone: string;
  currentEpisodeId: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
};

export type SessionUser = User & { preferences: Preferences };

export function defaultPreferences(level: CefrLevel): Preferences {
  return {
    level,
    nativeLanguage: "pt-BR",
    dailyGoal: 100,
    preferredAccent: "US",
    audioSpeed: 1,
    timezone: DEFAULT_TIMEZONE,
    currentEpisodeId: null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function pickAvatarColor(seed: string): string {
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}
