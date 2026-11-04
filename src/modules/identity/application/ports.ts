import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";
import type { Preferences, User } from "../domain/user";

export type UserRecord = User & { passwordHash: string };
export type NewUser = Omit<UserRecord, "isAdmin">;

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<User | null>;
  findAdmin(): Promise<User | null>;
  create(user: NewUser, preferences: Preferences, createdAt: Date): Promise<void>;
  listByEmailSuffix(suffix: string): Promise<(User & { level: Preferences["level"] })[]>;
  hasAccounts(): Promise<boolean>;
}

export type AccountSummary = User & { createdAt: Date; lastActiveAt: Date | null };
export type AdminChange = "changed" | "last_admin" | "not_found";
export type AccountRemoval = "removed" | "last_admin" | "not_found";

export interface AccountRepository {
  listAccounts(): Promise<AccountSummary[]>;
  setAdmin(accountId: string, isAdmin: boolean): Promise<AdminChange>;
  replacePassword(accountId: string, passwordHash: string): Promise<boolean>;
  removeAccount(accountId: string): Promise<AccountRemoval>;
}

export interface AccountFiles {
  removeFor(accountId: string): Promise<void>;
}

export interface SetupCodeGate {
  matches(candidate: string): Promise<boolean>;
  consume(): Promise<void>;
}

export type FirstAccountProof = { cookieCode?: string; typedCode?: string };

export type FirstAccountPolicy = "setup-code" | "open";

export interface SessionRepository {
  createSession(session: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<void>;
  findUserIdByTokenHash(tokenHash: string, now: Date): Promise<string | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}

export interface PreferencesRepository {
  get(userId: string): Promise<Preferences | null>;
  update(userId: string, patch: Partial<Preferences>): Promise<void>;
}

export type StoredLanguagePair = LanguagePair & { level: CefrLevel };

export interface LanguagePairRepository {
  listPairs(userId: string): Promise<StoredLanguagePair[]>;
  upsertPair(userId: string, pair: StoredLanguagePair, now: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, stored: string | null): Promise<boolean>;
}

export interface SessionTokens {
  issue(): { token: string; tokenHash: string };
  hash(token: string): string;
}
