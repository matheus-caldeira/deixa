import { describe, expect, it } from "vitest";
import { POSTGRES_VERSION, artifactFor, artifactUrl } from "./binaries";
import { connectionUrl } from "./server";

describe("binários do Postgres embutido", () => {
  it("escolhe o artefato pela plataforma e arquitetura, e nega o que não tem", () => {
    expect(artifactFor("darwin", "arm64")?.name).toBe("darwin-arm64v8");
    expect(artifactFor("win32", "x64")?.name).toBe("windows-amd64");
    expect(artifactFor("linux", "arm64")?.name).toBe("linux-arm64v8");
    expect(artifactFor("win32", "arm64")).toBeNull();
    expect(artifactFor("freebsd", "x64")).toBeNull();
  });

  it("aponta para o Maven Central na versão fixada, com hash de 64 hexadecimais", () => {
    const artifact = artifactFor("linux", "x64");
    expect(artifact?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(artifactUrl(artifact!)).toBe(
      `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-linux-amd64/${POSTGRES_VERSION}/embedded-postgres-binaries-linux-amd64-${POSTGRES_VERSION}.jar`,
    );
  });

  it("monta a URL de conexão local com a senha escapada", () => {
    expect(
      connectionUrl({
        version: POSTGRES_VERSION,
        port: 1443,
        user: "deixa",
        password: "a/b+c",
        database: "deixa",
      }),
    ).toBe("postgres://deixa:a%2Fb%2Bc@127.0.0.1:1443/deixa");
  });
});
