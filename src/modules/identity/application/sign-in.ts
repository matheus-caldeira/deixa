import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { MS_PER_DAY } from "@/shared/time";
import { normalizeEmail } from "../domain/user";
import type { PasswordHasher, SessionRepository, SessionTokens, UserRepository } from "./ports";

export const SESSION_TTL_DAYS = 30;

export type IssuedSession = { token: string; expiresAt: Date; userId: string };

export function makeSignIn(deps: {
  users: UserRepository;
  sessions: SessionRepository;
  passwords: PasswordHasher;
  tokens: SessionTokens;
  clock: Clock;
  ids: IdGenerator;
}) {
  return async function signIn(input: { email: string; password: string }): Promise<IssuedSession> {
    const user = await deps.users.findByEmail(normalizeEmail(input.email));
    const passwordMatches = user ? await deps.passwords.verify(input.password, user.passwordHash) : false;
    if (!user || !passwordMatches) throw new AppError("INVALID_CREDENTIALS");
    const now = deps.clock.now();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * MS_PER_DAY);
    const { token, tokenHash } = deps.tokens.issue();
    await deps.sessions.createSession({
      id: deps.ids.next(),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: now,
    });
    return { token, expiresAt, userId: user.id };
  };
}
