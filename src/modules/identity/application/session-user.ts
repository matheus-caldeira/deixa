import type { Clock } from "@/shared/clock";
import type { SessionUser } from "../domain/user";
import type { PreferencesRepository, SessionRepository, SessionTokens, UserRepository } from "./ports";

export function makeGetSessionUser(deps: {
  users: UserRepository;
  sessions: SessionRepository;
  preferences: PreferencesRepository;
  tokens: SessionTokens;
  clock: Clock;
}) {
  return async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
    if (!token) return null;
    const userId = await deps.sessions.findUserIdByTokenHash(deps.tokens.hash(token), deps.clock.now());
    if (!userId) return null;
    const [user, preferences] = await Promise.all([
      deps.users.findById(userId),
      deps.preferences.get(userId),
    ]);
    if (!user || !preferences) return null;
    return { ...user, preferences };
  };
}

export function makeSignOut(deps: { sessions: SessionRepository; tokens: SessionTokens }) {
  return async function signOut(token: string | undefined): Promise<void> {
    if (token) await deps.sessions.deleteByTokenHash(deps.tokens.hash(token));
  };
}
