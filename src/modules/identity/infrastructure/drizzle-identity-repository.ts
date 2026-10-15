import { and, eq, gt, like, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import { sessions, userPreferences, users } from "@/infrastructure/database/schema";
import { isCefrLevel } from "@/shared/levels";
import { DEFAULT_LOCALE, isLocale } from "@/shared/locales";
import type { Accent, Preferences, User } from "../domain/user";
import type {
  NewUser,
  PreferencesRepository,
  SessionRepository,
  UserRecord,
  UserRepository,
} from "../application/ports";

const FIRST_ACCOUNT_LOCK = 7_301_001;

type PreferencesRow = typeof userPreferences.$inferSelect;

function toPreferences(row: PreferencesRow): Preferences {
  return {
    level: isCefrLevel(row.level) ? row.level : "A1",
    nativeLanguage: row.nativeLanguage,
    locale: isLocale(row.locale) ? row.locale : DEFAULT_LOCALE,
    dailyGoal: row.dailyGoal,
    preferredAccent: (row.preferredAccent === "UK" ? "UK" : "US") satisfies Accent,
    audioSpeed: row.audioSpeed,
    timezone: row.timezone,
    currentEpisodeId: row.currentEpisodeId,
  };
}

export class DrizzleIdentityRepository implements UserRepository, SessionRepository, PreferencesRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarColor: row.avatarColor,
      isAdmin: row.isAdmin,
      passwordHash: row.passwordHash,
    };
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ?? null;
  }

  async findAdmin(): Promise<User | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.isAdmin, true))
      .orderBy(users.createdAt, users.email)
      .limit(1);
    return row ?? null;
  }

  async create(user: NewUser, preferences: Preferences, createdAt: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_ACCOUNT_LOCK})`);
      await tx.insert(users).values({
        ...user,
        isAdmin: sql<boolean>`not exists (select 1 from ${users})`,
        createdAt,
      });
      await tx.insert(userPreferences).values({ userId: user.id, ...preferences });
    });
  }

  async createSession(session: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async listByEmailSuffix(suffix: string): Promise<(User & { level: Preferences["level"] })[]> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
        isAdmin: users.isAdmin,
        level: userPreferences.level,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(userPreferences, eq(userPreferences.userId, users.id))
      .where(like(users.email, `%${suffix}`))
      .orderBy(users.createdAt, users.email);
    return rows.map(({ createdAt: _createdAt, level, ...user }) => ({
      ...user,
      level: isCefrLevel(level) ? level : "A1",
    }));
  }

  async findUserIdByTokenHash(tokenHash: string, now: Date): Promise<string | null> {
    const [row] = await this.db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
      .limit(1);
    return row?.userId ?? null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async get(userId: string): Promise<Preferences | null> {
    const [row] = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    return row ? toPreferences(row) : null;
  }

  async update(userId: string, patch: Partial<Preferences>): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(userPreferences).set(patch).where(eq(userPreferences.userId, userId));
  }
}
