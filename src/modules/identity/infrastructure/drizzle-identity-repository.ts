import { and, count, eq, gt, like, max, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import {
  jobQueue,
  sessions,
  userLanguagePairs,
  userPreferences,
  users,
} from "@/infrastructure/database/schema";
import { isStudyLanguage, type StudyLanguage } from "@/shared/study-languages";
import { isCefrLevel } from "@/shared/levels";
import { DEFAULT_LOCALE, isLocale } from "@/shared/locales";
import type { Accent, Preferences, User } from "../domain/user";
import type {
  AccountRemoval,
  AccountRepository,
  AccountSummary,
  AdminChange,
  LanguagePairRepository,
  NewUser,
  PreferencesRepository,
  StoredLanguagePair,
  SessionRepository,
  UserRecord,
  UserRepository,
} from "../application/ports";

const ACCOUNTS_LOCK = 7_301_001;

const toStudyLanguage = (value: string, fallback: StudyLanguage): StudyLanguage =>
  isStudyLanguage(value) ? value : fallback;

type PreferencesRow = typeof userPreferences.$inferSelect;

function toPreferences(row: PreferencesRow): Preferences {
  return {
    level: isCefrLevel(row.level) ? row.level : "A1",
    nativeLanguage: toStudyLanguage(row.nativeLanguage, "pt-BR"),
    targetLanguage: toStudyLanguage(row.targetLanguage, "en"),
    locale: isLocale(row.locale) ? row.locale : DEFAULT_LOCALE,
    dailyGoal: row.dailyGoal,
    preferredAccent: (row.preferredAccent === "UK" ? "UK" : "US") satisfies Accent,
    audioSpeed: row.audioSpeed,
    timezone: row.timezone,
    currentEpisodeId: row.currentEpisodeId,
  };
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function lockAccounts(tx: Transaction): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${ACCOUNTS_LOCK})`);
}

async function isLastAdmin(tx: Transaction, accountId: string): Promise<boolean | null> {
  const [target] = await tx
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, accountId))
    .limit(1);
  if (!target) return null;
  if (!target.isAdmin) return false;
  const [admins] = await tx.select({ total: count() }).from(users).where(eq(users.isAdmin, true));
  return (admins?.total ?? 0) <= 1;
}

export class DrizzleIdentityRepository
  implements
    UserRepository,
    SessionRepository,
    PreferencesRepository,
    LanguagePairRepository,
    AccountRepository
{
  constructor(private readonly db: Database) {}

  async hasAccounts(): Promise<boolean> {
    const [row] = await this.db.select({ id: users.id }).from(users).limit(1);
    return row !== undefined;
  }

  async listAccounts(): Promise<AccountSummary[]> {
    const [rows, activity] = await Promise.all([
      this.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarColor: users.avatarColor,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt, users.email),
      this.db
        .select({ userId: sessions.userId, lastActiveAt: max(sessions.createdAt) })
        .from(sessions)
        .groupBy(sessions.userId),
    ]);
    const lastActive = new Map(activity.map((entry) => [entry.userId, entry.lastActiveAt]));
    return rows.map((row) => ({ ...row, lastActiveAt: lastActive.get(row.id) ?? null }));
  }

  async setAdmin(accountId: string, isAdmin: boolean): Promise<AdminChange> {
    return this.db.transaction(async (tx) => {
      await lockAccounts(tx);
      const last = await isLastAdmin(tx, accountId);
      if (last === null) return "not_found";
      if (!isAdmin && last) return "last_admin";
      await tx.update(users).set({ isAdmin }).where(eq(users.id, accountId));
      return "changed";
    });
  }

  async replacePassword(accountId: string, passwordHash: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, accountId))
        .returning({ id: users.id });
      if (updated.length === 0) return false;
      await tx.delete(sessions).where(eq(sessions.userId, accountId));
      return true;
    });
  }

  async removeAccount(accountId: string): Promise<AccountRemoval> {
    return this.db.transaction(async (tx) => {
      await lockAccounts(tx);
      const last = await isLastAdmin(tx, accountId);
      if (last === null) return "not_found";
      if (last) return "last_admin";
      await tx.delete(jobQueue).where(sql`${jobQueue.payload} ->> 'userId' = ${accountId}`);
      await tx.delete(users).where(eq(users.id, accountId));
      return "removed";
    });
  }

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
      await lockAccounts(tx);
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

  async listPairs(userId: string): Promise<StoredLanguagePair[]> {
    const rows = await this.db
      .select()
      .from(userLanguagePairs)
      .where(eq(userLanguagePairs.userId, userId))
      .orderBy(userLanguagePairs.createdAt);
    return rows.flatMap((row) =>
      isStudyLanguage(row.targetLanguage) && isStudyLanguage(row.nativeLanguage)
        ? [
            {
              target: row.targetLanguage,
              native: row.nativeLanguage,
              level: isCefrLevel(row.level) ? row.level : "A1",
            },
          ]
        : [],
    );
  }

  async upsertPair(userId: string, pair: StoredLanguagePair, now: Date): Promise<void> {
    await this.db
      .insert(userLanguagePairs)
      .values({
        userId,
        targetLanguage: pair.target,
        nativeLanguage: pair.native,
        level: pair.level,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [
          userLanguagePairs.userId,
          userLanguagePairs.targetLanguage,
          userLanguagePairs.nativeLanguage,
        ],
        set: { level: pair.level },
      });
  }
}
