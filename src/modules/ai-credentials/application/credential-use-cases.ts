import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import { maskSecret } from "../domain/api-key";
import {
  CREDENTIAL_SERVICES,
  SECRET_KINDS,
  SERVICE_LABELS,
  looksLikeSecret,
  shapeHint,
  type CredentialService,
} from "../domain/services";
import type { CredentialRepository, CredentialTester, KeyCipher, StoredCredential } from "./ports";

export type CredentialScope = "user" | "global";
export type CredentialActor = { userId: string; isAdmin: boolean };

type Deps = {
  credentials: CredentialRepository;
  cipher: KeyCipher;
  testCredential: CredentialTester;
  environmentServices: ReadonlySet<CredentialService>;
  endpointsAllowed?: () => Promise<boolean>;
  clock: Clock;
};

export type StoredState = { state: "absent" } | { state: "ready"; masked: string } | { state: "unreadable" };
export type GlobalSource = "database" | "environment" | null;

export type ServiceOverview = {
  service: CredentialService;
  label: string;
  own: StoredState;
  global: { source: GlobalSource; stored: StoredState | null };
  active: "own" | "global" | "none";
};

export type ResolvedCredential = { secret: string; origin: "user" | "global" };

function read(cipher: KeyCipher, stored: StoredCredential | null | undefined): string | null | "unreadable" {
  if (!stored) return null;
  try {
    return cipher.decrypt(stored.encryptedApiKey);
  } catch {
    return "unreadable";
  }
}

function describeStored(
  cipher: KeyCipher,
  service: CredentialService,
  stored: StoredCredential | null | undefined,
): StoredState {
  const secret = read(cipher, stored);
  if (secret === null) return { state: "absent" };
  return secret === "unreadable"
    ? { state: "unreadable" }
    : { state: "ready", masked: maskSecret(service, secret) };
}

function requireAdmin(actor: CredentialActor, scope: CredentialScope): void {
  if (scope === "global" && !actor.isAdmin) {
    throw new AppError("FORBIDDEN", "Só o administrador altera as chaves globais.");
  }
}

export function makeSaveCredential(deps: Deps) {
  return async function saveCredential(input: {
    actor: CredentialActor;
    service: CredentialService;
    scope: CredentialScope;
    secret: string;
  }): Promise<StoredState> {
    requireAdmin(input.actor, input.scope);
    if (SECRET_KINDS[input.service] === "endpoint" && !input.actor.isAdmin) {
      const allowed = deps.endpointsAllowed ? await deps.endpointsAllowed() : true;
      if (!allowed) {
        throw new AppError("FORBIDDEN", "O administrador desligou endereços próprios de IA por conta.");
      }
    }
    const secret = input.secret.trim();
    if (!looksLikeSecret(input.service, secret)) {
      throw new AppError("AI_KEY_INVALID", `Essa chave não parece válida. ${shapeHint(input.service)}`);
    }
    if (!(await deps.testCredential(input.service, secret))) {
      throw new AppError(
        "AI_KEY_REJECTED",
        `${SERVICE_LABELS[input.service]} recusou essa chave. Confira se ela está ativa.`,
      );
    }
    const stored = { encryptedApiKey: deps.cipher.encrypt(secret), keyVersion: deps.cipher.version };
    if (input.scope === "global") {
      await deps.credentials.upsertGlobal(input.service, stored, input.actor.userId, deps.clock.now());
    } else {
      await deps.credentials.upsertForUser(input.actor.userId, input.service, stored, deps.clock.now());
    }
    return { state: "ready", masked: maskSecret(input.service, secret) };
  };
}

export function makeRemoveCredential(deps: Pick<Deps, "credentials">) {
  return async function removeCredential(input: {
    actor: CredentialActor;
    service: CredentialService;
    scope: CredentialScope;
  }): Promise<void> {
    requireAdmin(input.actor, input.scope);
    if (input.scope === "global") await deps.credentials.deleteGlobal(input.service);
    else await deps.credentials.deleteForUser(input.actor.userId, input.service);
  };
}

export function makeGetCredentialOverview(
  deps: Pick<Deps, "credentials" | "cipher" | "environmentServices">,
) {
  return async function getCredentialOverview(actor: CredentialActor): Promise<ServiceOverview[]> {
    const [own, global] = await Promise.all([
      deps.credentials.listForUser(actor.userId),
      deps.credentials.listGlobal(),
    ]);
    return CREDENTIAL_SERVICES.map((service) => {
      const ownState = describeStored(
        deps.cipher,
        service,
        own.find((entry) => entry.service === service),
      );
      const globalState = describeStored(
        deps.cipher,
        service,
        global.find((entry) => entry.service === service),
      );
      const fromEnvironment = deps.environmentServices.has(service);
      const source: GlobalSource =
        globalState.state === "ready" ? "database" : fromEnvironment ? "environment" : null;
      return {
        service,
        label: SERVICE_LABELS[service],
        own: ownState,
        global: {
          source,
          stored: actor.isAdmin ? globalState : null,
        },
        active: ownState.state === "ready" ? "own" : source ? "global" : "none",
      };
    });
  };
}

export function makeResolveCredential(deps: Pick<Deps, "credentials" | "cipher">) {
  return async function resolveCredential(
    userId: string | null,
    service: CredentialService,
  ): Promise<ResolvedCredential | null> {
    if (userId) {
      const own = read(deps.cipher, await deps.credentials.getForUser(userId, service));
      if (own && own !== "unreadable") return { secret: own, origin: "user" };
    }
    const shared = read(deps.cipher, await deps.credentials.getGlobal(service));
    return shared && shared !== "unreadable" ? { secret: shared, origin: "global" } : null;
  };
}

export function unreadableCredentials(overview: readonly ServiceOverview[]): {
  own: string[];
  global: string[];
} {
  return {
    own: overview.filter((entry) => entry.own.state === "unreadable").map((entry) => entry.label),
    global: overview
      .filter((entry) => entry.global.stored?.state === "unreadable")
      .map((entry) => entry.label),
  };
}
