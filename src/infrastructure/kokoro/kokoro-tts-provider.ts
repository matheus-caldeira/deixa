import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import type { TtsProvider, Voice } from "@/modules/audio";
import { resolveAllowedAddresses, type ResolvedAddress } from "./service-address";

const TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 2000;
const MODEL = "kokoro";
const AUDIO_TYPE = "audio/";
const OK = 200;
const MAX_AUDIO_BYTES = 30_000_000;
const CONNECTION_ERRORS = new Set(["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "EADDRNOTAVAIL"]);

type PinnedResponse = { status: number; contentType: string; bytes: Uint8Array };

function pinnedLookup(target: ResolvedAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (typeof options === "object" && options.all) {
      callback(null, [{ address: target.address, family: target.family }]);
      return;
    }
    callback(null, target.address, target.family);
  };
}

function sendTo(input: {
  url: string;
  method: "GET" | "POST";
  body?: string;
  signal: AbortSignal;
  target: ResolvedAddress;
}): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(input.url);
    const open = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = open(
      url,
      {
        method: input.method,
        signal: input.signal,
        lookup: pinnedLookup(input.target),
        headers: input.body
          ? { "content-type": "application/json", "content-length": Buffer.byteLength(input.body) }
          : {},
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_AUDIO_BYTES) request.destroy(new Error("resposta do Kokoro grande demais"));
          else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            contentType: response.headers["content-type"] ?? "",
            bytes: new Uint8Array(Buffer.concat(chunks)),
          }),
        );
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end(input.body);
  });
}

export class KokoroTtsProvider implements TtsProvider {
  readonly name = "kokoro" as const;
  readonly modelVersion = "kokoro-v1.0";
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  voiceFor(requested: Voice): Voice {
    return requested;
  }

  private async send(request: {
    path: string;
    method: "GET" | "POST";
    body?: string;
    timeoutMs: number;
  }): Promise<PinnedResponse> {
    const signal = AbortSignal.timeout(request.timeoutMs);
    const expired = new Promise<never>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Kokoro did not answer in time")), {
        once: true,
      });
    });
    expired.catch(() => undefined);
    const targets = await Promise.race([resolveAllowedAddresses(this.baseUrl), expired]);
    if (targets.length === 0) {
      throw new Error("Kokoro address is neither local nor on a private network");
    }
    let failure: unknown = new Error("Kokoro has no address to connect to");
    for (const target of targets) {
      try {
        return await sendTo({
          url: `${this.baseUrl}${request.path}`,
          method: request.method,
          body: request.body,
          signal,
          target,
        });
      } catch (error) {
        failure = error;
        if (signal.aborted || !CONNECTION_ERRORS.has((error as { code?: string }).code ?? "")) throw error;
      }
    }
    throw failure;
  }

  async synthesize(input: { text: string; voice: Voice }): Promise<Uint8Array> {
    const response = await this.send({
      path: "/v1/audio/speech",
      method: "POST",
      body: JSON.stringify({
        model: MODEL,
        voice: input.voice.voiceId,
        input: input.text,
        response_format: "wav",
      }),
      timeoutMs: TIMEOUT_MS,
    });
    if (response.status !== OK) throw new Error(`Kokoro respondeu ${response.status}`);
    if (!response.contentType.startsWith(AUDIO_TYPE)) {
      throw new Error("Kokoro answered with non-audio content");
    }
    return response.bytes;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.send({ path: "/health", method: "GET", timeoutMs: HEALTH_TIMEOUT_MS });
      return response.status === OK;
    } catch {
      return false;
    }
  }
}
