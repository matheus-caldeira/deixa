import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  connectAndPrepare,
  describeConnectionError,
  detectLocalServers,
  isPostgresUrl,
} from "./database-probe";

const servers: Server[] = [];

function listen(answer: string | null): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer((socket) => {
      socket.once("data", () => (answer === null ? socket.destroy() : socket.end(answer)));
    });
    servers.push(server);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe("sondagem de Postgres local", () => {
  it("reconhece quem responde ao pedido de SSL como Postgres e ignora o resto", async () => {
    const postgres = await listen("N");
    const withSsl = await listen("S");
    const web = await listen("HTTP/1.1 400 Bad Request\r\n\r\n");
    const mute = await listen(null);
    const closed = await listen("N");
    servers.pop()?.close();
    const found = await detectLocalServers([postgres, withSsl, web, mute, closed]);
    expect(found).toEqual([
      { host: "localhost", port: postgres },
      { host: "localhost", port: withSsl },
    ]);
  });

  it("valida o formato do endereço antes de tentar conectar", async () => {
    expect(isPostgresUrl("postgres://usuario:senha@localhost:5432/deixa")).toBe(true);
    expect(isPostgresUrl("postgresql://usuario@servidor/deixa_2")).toBe(true);
    expect(isPostgresUrl("mysql://usuario:senha@localhost/deixa")).toBe(false);
    expect(isPostgresUrl("postgres://usuario:senha@localhost:5432/")).toBe(false);
    expect(isPostgresUrl("postgres://usuario:senha@localhost:5432/Deixa; drop")).toBe(false);
    expect(isPostgresUrl("não é endereço")).toBe(false);
    expect(await connectAndPrepare("http://localhost/deixa")).toMatchObject({ ok: false });
  });

  it("traduz os erros de conexão sem expor detalhes do servidor", () => {
    expect(describeConnectionError({ code: "ECONNREFUSED" })).toMatch(/Não há Postgres respondendo/);
    expect(describeConnectionError({ code: "28P01" })).toMatch(/Usuário ou senha recusados/);
    expect(describeConnectionError({ code: "42501" })).toMatch(/permissão/);
    const unknown = describeConnectionError(new Error("relation secreta em 10.0.0.7"));
    expect(unknown).toBe("Não foi possível conectar. Confira os dados e tente de novo.");
  });
});
