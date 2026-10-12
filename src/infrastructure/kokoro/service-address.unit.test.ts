import { describe, expect, it } from "vitest";
import { isAllowedAddress, resolveAllowedAddresses } from "./service-address";

describe("endereço resolvido do serviço de voz", () => {
  it("aceita só este computador e redes privadas", () => {
    for (const allowed of [
      "127.0.0.1",
      "192.168.1.20",
      "10.0.0.5",
      "172.20.3.4",
      "100.101.102.103",
      "::1",
      "fd12:3456::1",
      "::ffff:192.168.1.20",
      "::ffff:c0a8:0114",
    ]) {
      expect(isAllowedAddress(allowed), allowed).toBe(true);
    }
    for (const refused of [
      "169.254.169.254",
      "0.0.0.0",
      "8.8.8.8",
      "224.0.0.1",
      "255.255.255.255",
      "100.100.100.200",
      "::",
      "fe80::1",
      "2002:a9fe:a9fe::1",
      "64:ff9b::a9fe:a9fe",
      "fd00:ec2::254",
      "::ffff:169.254.169.254",
      "::ffff:a9fe:a9fe",
      "não é endereço",
    ]) {
      expect(isAllowedAddress(refused), refused).toBe(false);
    }
  });

  it("devolve os endereços já conferidos, para a conexão usar exatamente eles", async () => {
    const toLan = async () => ["192.168.1.20"];
    const both = async () => ["::1", "127.0.0.1"];
    const toMetadata = async () => ["169.254.169.254"];
    const mixed = async () => ["192.168.1.20", "fe80::1"];
    const nowhere = async () => [];
    expect(await resolveAllowedAddresses("http://voz.interna:1881", toLan)).toEqual([
      { address: "192.168.1.20", family: 4 },
    ]);
    expect(await resolveAllowedAddresses("http://localhost:1881", both)).toEqual([
      { address: "::1", family: 6 },
      { address: "127.0.0.1", family: 4 },
    ]);
    expect(await resolveAllowedAddresses("http://voz.interna:1881", toMetadata)).toEqual([]);
    expect(await resolveAllowedAddresses("http://voz.interna:1881", mixed)).toEqual([]);
    expect(await resolveAllowedAddresses("http://voz.interna:1881", nowhere)).toEqual([]);
    expect(await resolveAllowedAddresses("http://127.0.0.1:1881", toMetadata)).toEqual([
      { address: "127.0.0.1", family: 4 },
    ]);
    expect(await resolveAllowedAddresses("http://[::1]:1881", toMetadata)).toEqual([
      { address: "::1", family: 6 },
    ]);
  });
});
