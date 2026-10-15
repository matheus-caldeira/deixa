import { z } from "zod";

export const SKILLS = ["listening", "vocabulary", "grammar", "conversation"] as const;
export type Skill = (typeof SKILLS)[number];

export const profileSnapshotSchema = z.object({
  levelPct: z.number(),
  learnedBase: z.number(),
  accuracy: z.number(),
  skills: z.array(z.object({ key: z.enum(SKILLS), percent: z.number() })),
  achievements: z.array(z.string()),
});

export type ProfileSnapshot = z.infer<typeof profileSnapshotSchema>;

export const EMPTY_SNAPSHOT: ProfileSnapshot = {
  levelPct: 0,
  learnedBase: 0,
  accuracy: 0,
  skills: SKILLS.map((key) => ({ key, percent: 0 })),
  achievements: [],
};

export type AchievementIcon = "play" | "flame" | "quote" | "film" | "trophy" | "ear" | "chat" | "star";
export type Achievement = { id: string; icon: AchievementIcon };

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first", icon: "play" },
  { id: "streak3", icon: "flame" },
  { id: "streak7", icon: "flame" },
  { id: "phrasal25", icon: "quote" },
  { id: "ep10", icon: "film" },
  { id: "streak30", icon: "trophy" },
  { id: "nosub", icon: "ear" },
  { id: "tutor10", icon: "chat" },
  { id: "accent", icon: "star" },
];
