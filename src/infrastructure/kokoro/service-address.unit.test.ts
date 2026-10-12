import { describe, expect, it } from "vitest";
import { isBlockedAddress, resolvesToAllowedAddress } from "./service-address";

describe("endereço resolvido do serviço de voz", () => {
  it("bloqueia metadados, link-local e endereço não especificado, em IPv4, IPv6 e IPv4 mapeado", () => {
    for (const blocked of ["169.254.169.254", "0.0.0.0", "::", "fe80::1", "::ffff:169.254.169.254"]) {
      expect(isBlockedAddress(blocked), blocked).toBe(true);
    }
    for (const allowed of ["127.0.0.1", "192.168.1.20", "10.0.0.5", "::1", "::ffff:192.168.1.20"]) {
      expect(isBlockedAddress(allowed), allowed).toBe(false);
    }
  });

  it("confere para onde o nome resolve, não só o texto do endereço", async () => {
    const toMetadata = async () => ["169.254.169.254"];
    const mixed = async () => ["192.168.1.20", "fe80::1"];
    const toLan = async () => ["192.168.1.20"];
    const nowhere = async () => [];
    expect(await resolvesToAllowedAddress("http://voz.interna:1881", toMetadata)).toBe(false);
    expect(await resolvesToAllowedAddress("http://voz.interna:1881", mixed)).toBe(false);
    expect(await resolvesToAllowedAddress("http://voz.interna:1881", nowhere)).toBe(false);
    expect(await resolvesToAllowedAddress("http://voz.interna:1881", toLan)).toBe(true);
    expect(await resolvesToAllowedAddress("http://127.0.0.1:1881", toMetadata)).toBe(true);
    expect(await resolvesToAllowedAddress("http://[::1]:1881", toMetadata)).toBe(true);
  });
});
