import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import { MS_PER_DAY } from "@/shared/time";
import type { User } from "../domain/user";
import type { SessionRepository, SessionTokens, UserRepository } from "./ports";
import { SESSION_TTL_DAYS, type IssuedSession } from "./sign-in";

type Deps = {
  users: UserRepository;
  sessions: SessionRepository;
  tokens: SessionTokens;
  clock: Clock;
  ids: IdGenerator;
};

export function makeFindOwner(deps: Pick<Deps, "users">) {
  return async function findOwner(): Promise<User | null> {
    return deps.users.findAdmin();
  };
}

export function makeStartOwnerSession(deps: Deps) {
  return async function startOwnerSession(): Promise<IssuedSession | null> {
    const owner = await deps.users.findAdmin();
    if (!owner) return null;
    const now = deps.clock.now();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * MS_PER_DAY);
    const { token, tokenHash } = deps.tokens.issue();
    await deps.sessions.createSession({
      id: deps.ids.next(),
      userId: owner.id,
      tokenHash,
      expiresAt,
      createdAt: now,
    });
    return { token, expiresAt, userId: owner.id };
  };
}
