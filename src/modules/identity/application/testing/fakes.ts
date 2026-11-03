import type { Preferences, User } from "../../domain/user";
import type {
  AccountRemoval,
  AccountRepository,
  AccountSummary,
  AdminChange,
  LanguagePairRepository,
  NewUser,
  PasswordHasher,
  PreferencesRepository,
  SessionRepository,
  SessionTokens,
  StoredLanguagePair,
  UserRecord,
  UserRepository,
} from "../ports";

export class InMemoryIdentityStore
  implements
    UserRepository,
    SessionRepository,
    PreferencesRepository,
    LanguagePairRepository,
    AccountRepository
{
  readonly createdAtByUser = new Map<string, Date>();
  readonly pairsByUser = new Map<string, StoredLanguagePair[]>();
  readonly users = new Map<string, UserRecord>();
  readonly preferencesByUser = new Map<string, Preferences>();
  readonly sessions = new Map<string, { userId: string; expiresAt: Date; createdAt: Date }>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const record = this.users.get(id);
    if (!record) return null;
    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  }

  async findAdmin(): Promise<User | null> {
    const record = [...this.users.values()].find((user) => user.isAdmin);
    if (!record) return null;
    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  }

  async create(user: NewUser, preferences: Preferences, createdAt: Date): Promise<void> {
    const isAdmin = this.users.size === 0;
    this.users.set(user.id, { ...user, isAdmin });
    this.preferencesByUser.set(user.id, preferences);
    this.createdAtByUser.set(user.id, createdAt);
  }

  async hasAccounts(): Promise<boolean> {
    return this.users.size > 0;
  }

  async createSession(session: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<void> {
    this.sessions.set(session.tokenHash, {
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    });
  }

  async listAccounts(): Promise<AccountSummary[]> {
    return [...this.users.values()].map(({ passwordHash: _passwordHash, ...user }) => {
      const starts = [...this.sessions.values()]
        .filter((session) => session.userId === user.id)
        .map((session) => session.createdAt.getTime());
      return {
        ...user,
        createdAt: this.createdAtByUser.get(user.id) ?? new Date(0),
        lastActiveAt: starts.length > 0 ? new Date(Math.max(...starts)) : null,
      };
    });
  }

  private isLastAdmin(accountId: string): boolean {
    const admins = [...this.users.values()].filter((user) => user.isAdmin);
    return admins.length === 1 && admins[0]?.id === accountId;
  }

  async setAdmin(accountId: string, isAdmin: boolean): Promise<AdminChange> {
    const record = this.users.get(accountId);
    if (!record) return "not_found";
    if (!isAdmin && this.isLastAdmin(accountId)) return "last_admin";
    this.users.set(accountId, { ...record, isAdmin });
    return "changed";
  }

  async replacePassword(accountId: string, passwordHash: string): Promise<boolean> {
    const record = this.users.get(accountId);
    if (!record) return false;
    this.users.set(accountId, { ...record, passwordHash });
    this.dropSessionsOf(accountId);
    return true;
  }

  async removeAccount(accountId: string): Promise<AccountRemoval> {
    if (!this.users.has(accountId)) return "not_found";
    if (this.isLastAdmin(accountId)) return "last_admin";
    this.users.delete(accountId);
    this.preferencesByUser.delete(accountId);
    this.pairsByUser.delete(accountId);
    this.createdAtByUser.delete(accountId);
    this.dropSessionsOf(accountId);
    return "removed";
  }

  private dropSessionsOf(accountId: string): void {
    for (const [tokenHash, session] of this.sessions) {
      if (session.userId === accountId) this.sessions.delete(tokenHash);
    }
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
  async listPairs(userId: string): Promise<StoredLanguagePair[]> {
    return [...(this.pairsByUser.get(userId) ?? [])];
  }

  async upsertPair(userId: string, pair: StoredLanguagePair): Promise<void> {
    const current = (this.pairsByUser.get(userId) ?? []).filter(
      (candidate) => candidate.target !== pair.target || candidate.native !== pair.native,
    );
    this.pairsByUser.set(userId, [...current, pair]);
  }
}

export const passwordChecks: { plain: string; hadStoredHash: boolean }[] = [];

export const plainPasswords: PasswordHasher = {
  hash: async (plain) => `plain:${plain}`,
  verify: async (plain, stored) => {
    passwordChecks.push({ plain, hadStoredHash: stored !== null });
    return stored === `plain:${plain}`;
  },
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
