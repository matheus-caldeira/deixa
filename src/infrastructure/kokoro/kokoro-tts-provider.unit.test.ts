import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { KokoroTtsProvider } from "./kokoro-tts-provider";

const servers: Server[] = [];
const DRIP_MS = 300;
const HEALTH_LIMIT_MS = 2000;
const SLACK_MS = 1500;

function listen(handler: Parameters<typeof createServer>[1]): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    servers.push(server);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`);
    });
  });
}

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

describe("provider do Kokoro", () => {
  it("devolve o áudio de um servidor local e recusa resposta que não é áudio", async () => {
    const audio = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "audio/wav" }).end(Buffer.from("RIFFdados"));
    });
    const voice = { voiceId: "af_heart" } as never;
    const bytes = await new KokoroTtsProvider(audio).synthesize({ text: "Hi", voice });
    expect(Buffer.from(bytes).toString("latin1")).toBe("RIFFdados");

    const html = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/html" }).end("<html></html>");
    });
    await expect(new KokoroTtsProvider(html).synthesize({ text: "Hi", voice })).rejects.toThrow(
      /não é áudio/,
    );
    const redirect = await listen((_request, response) => {
      response.writeHead(302, { location: "http://example.com/" }).end();
    });
    await expect(new KokoroTtsProvider(redirect).synthesize({ text: "Hi", voice })).rejects.toThrow(/302/);
  });

  it("o tempo limite vale para a resposta inteira, mesmo com o servidor mandando dados aos poucos", async () => {
    const dripping = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      const timer = setInterval(() => response.write("."), DRIP_MS);
      response.on("close", () => clearInterval(timer));
    });
    const started = Date.now();
    expect(await new KokoroTtsProvider(dripping).isHealthy()).toBe(false);
    expect(Date.now() - started).toBeLessThan(HEALTH_LIMIT_MS + SLACK_MS);
  }, 10_000);

  it("o prazo vencer depois de uma resposta bem-sucedida não gera erro solto", async () => {
    const healthy = await listen((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
    });
    const loose: unknown[] = [];
    const record = (reason: unknown) => loose.push(reason);
    process.on("unhandledRejection", record);
    try {
      expect(await new KokoroTtsProvider(healthy).isHealthy()).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, HEALTH_LIMIT_MS + DRIP_MS));
    } finally {
      process.off("unhandledRejection", record);
    }
    expect(loose).toEqual([]);
  }, 10_000);

  it("endereço fora deste computador e de redes privadas nem é contatado", async () => {
    expect(await new KokoroTtsProvider("http://8.8.8.8:1881").isHealthy()).toBe(false);
    await expect(
      new KokoroTtsProvider("http://169.254.169.254").synthesize({
        text: "Hi",
        voice: { voiceId: "x" } as never,
      }),
    ).rejects.toThrow(/rede privada/);
  });
});
