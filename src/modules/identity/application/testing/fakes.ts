import type { Preferences, User } from "../../domain/user";
import type {
  PasswordHasher,
  PreferencesRepository,
  SessionRepository,
  SessionTokens,
  UserRecord,
  UserRepository,
} from "../ports";

export class InMemoryIdentityStore implements UserRepository, SessionRepository, PreferencesRepository {
  readonly users = new Map<string, UserRecord>();
  readonly preferencesByUser = new Map<string, Preferences>();
  readonly sessions = new Map<string, { userId: string; expiresAt: Date }>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const record = this.users.get(id);
    if (!record) return null;
    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  }

  async create(user: UserRecord, preferences: Preferences): Promise<void> {
    this.users.set(user.id, user);
    this.preferencesByUser.set(user.id, preferences);
  }

  async createSession(session: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    this.sessions.set(session.tokenHash, { userId: session.userId, expiresAt: session.expiresAt });
  }

  async listByEmailSuffix(suffix: string): Promise<(User & { level: Preferences["level"] })[]> {
    return [...this.users.values()]
      .filter((user) => user.email.endsWith(suffix))
      .map(({ passwordHash: _passwordHash, ...user }) => ({
        ...user,
        level: this.preferencesByUser.get(user.id)?.level ?? "A1",
      }));
  }

  async findUserIdByTokenHash(tokenHash: string, now: Date): Promise<string | null> {
    const session = this.sessions.get(tokenHash);
    return session && session.expiresAt > now ? session.userId : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async get(userId: string): Promise<Preferences | null> {
    return this.preferencesByUser.get(userId) ?? null;
  }

  async update(userId: string, patch: Partial<Preferences>): Promise<void> {
    const current = this.preferencesByUser.get(userId);
    if (current) this.preferencesByUser.set(userId, { ...current, ...patch });
  }
}

export const plainPasswords: PasswordHasher = {
  hash: async (plain) => `plain:${plain}`,
  verify: async (plain, stored) => stored === `plain:${plain}`,
};

export function sequentialTokens(): SessionTokens {
  let counter = 0;
  return {
    issue: () => {
      counter += 1;
      return { token: `token-${counter}`, tokenHash: `hash:token-${counter}` };
    },
    hash: (token) => `hash:${token}`,
  };
}
