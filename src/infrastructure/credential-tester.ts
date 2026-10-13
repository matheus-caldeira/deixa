import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isAiService, parseEndpoint, tmdbSecretKind, type CredentialService } from "@/modules/ai-credentials";
import { testAiApiKey } from "./ai/test-api-key";
import { TmdbClient } from "./tmdb/client";

const OPENSUBTITLES_CHECK_URL = "https://api.opensubtitles.com/api/v1/utilities/guessit";
const OPENSUBTITLES_USER_AGENT = "Deixa v0.1";
const TIMEOUT_MS = 8000;

async function testTmdb(secret: string): Promise<boolean> {
  const client = new TmdbClient(
    tmdbSecretKind(secret) === "apiKey" ? { apiKey: secret } : { readAccessToken: secret },
  );
  try {
    await client.get("configuration", {}, z.object({}).loose());
    return true;
  } catch {
    return false;
  }
}

async function testOpenSubtitles(secret: string): Promise<boolean> {
  try {
    const uncached = `${OPENSUBTITLES_CHECK_URL}?filename=${randomUUID()}.s01e01.mkv`;
    const response = await fetch(uncached, {
      headers: { "api-key": secret, "user-agent": OPENSUBTITLES_USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function testServiceCredential(service: CredentialService, secret: string): Promise<boolean> {
  if (isAiService(service)) {
    const endpoint = parseEndpoint(secret);
    return testAiApiKey(
      endpoint
        ? { provider: service, apiKey: endpoint.apiKey, baseUrl: endpoint.baseUrl }
        : { provider: service, apiKey: secret, baseUrl: null },
    );
  }
  if (service === "tmdb") return testTmdb(secret);
  return testOpenSubtitles(secret);
}
