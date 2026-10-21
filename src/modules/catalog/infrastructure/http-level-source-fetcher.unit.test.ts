import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpLevelSourceFetcher, isPublicAddress } from "./http-level-source-fetcher";

const LOOPBACK = "127.0.0.1";

describe("baixador de fontes de nível", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === "/indice.json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ "tv:1668": "B1-B2" }));
      } else if (request.url === "/move") {
        response.writeHead(302, { location: "/indice.json" });
        response.end();
      } else if (request.url === "/texto") {
        response.writeHead(200);
        response.end("não é json");
      } else {
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, LOOPBACK, resolve));
    base = `http://${LOOPBACK}:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("separa endereço público de rede interna, inclusive IPv6 e IPv4 mapeado", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.14",
      "169.254.169.254",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "nome",
    ]) {
      expect(isPublicAddress(address)).toBe(false);
    }
  });

  it("bloqueia a rede interna por padrão, por IP ou por nome", async () => {
    const fetcher = new HttpLevelSourceFetcher();
    expect(await fetcher.fetchJson(`${base}/indice.json`)).toEqual({
      ok: false,
      reason: "blocked",
      status: null,
    });
    const port = (server.address() as AddressInfo).port;
    expect(await fetcher.fetchJson(`http://localhost:${port}/indice.json`)).toEqual({
      ok: false,
      reason: "blocked",
      status: null,
    });
  });

  it("com a rede interna liberada, baixa, segue redirecionamento e explica a falha", async () => {
    const fetcher = new HttpLevelSourceFetcher({ allowPrivateNetwork: true });
    expect(await fetcher.fetchJson(`${base}/indice.json`)).toEqual({
      ok: true,
      data: { "tv:1668": "B1-B2" },
    });
    expect(await fetcher.fetchJson(`${base}/move`)).toEqual({ ok: true, data: { "tv:1668": "B1-B2" } });
    expect(await fetcher.fetchJson(`${base}/texto`)).toEqual({ ok: false, reason: "notJson", status: null });
    expect(await fetcher.fetchJson(`${base}/nada`)).toEqual({ ok: false, reason: "status", status: 404 });
  });
});
