import type { Preferences, User } from "../domain/user";

export type UserRecord = User & { passwordHash: string };

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<User | null>;
  create(user: UserRecord, preferences: Preferences, createdAt: Date): Promise<void>;
  listByEmailSuffix(suffix: string): Promise<(User & { level: Preferences["level"] })[]>;
}

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

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, stored: string): Promise<boolean>;
}

export interface SessionTokens {
  issue(): { token: string; tokenHash: string };
  hash(token: string): string;
}
