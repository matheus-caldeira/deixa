import { describe, expect, it } from "vitest";
import { isLoopbackAddress, isLoopbackForwardedFor, isLoopbackHost, isLoopbackRequest } from "./loopback";

describe("endereço de loopback", () => {
  it("reconhece IPv4, IPv6 e IPv4 mapeado em IPv6", () => {
    for (const address of ["127.0.0.1", "127.1.2.3", "::1", "[::1]", "::ffff:127.0.0.1", " 127.0.0.1 "]) {
      expect(isLoopbackAddress(address)).toBe(true);
    }
  });

  it("recusa endereço da rede, público ou malformado", () => {
    for (const address of [
      "192.168.0.10",
      "10.0.0.1",
      "8.8.8.8",
      "::ffff:192.168.0.2",
      "fe80::1",
      "127.0.0.256",
      "localhost",
      "",
    ]) {
      expect(isLoopbackAddress(address)).toBe(false);
    }
  });

  it("só aceita o cabeçalho com um único salto de loopback", () => {
    expect(isLoopbackForwardedFor("::1")).toBe(true);
    expect(isLoopbackForwardedFor("127.0.0.1, 192.168.0.4")).toBe(false);
    expect(isLoopbackForwardedFor("192.168.0.4")).toBe(false);
    expect(isLoopbackForwardedFor(null)).toBe(false);
    expect(isLoopbackForwardedFor(undefined)).toBe(false);
  });

  it("só aceita host do próprio computador, com ou sem porta", () => {
    for (const host of [
      "localhost",
      "localhost:1300",
      "LOCALHOST:1300",
      "127.0.0.1",
      "127.0.0.1:1300",
      "[::1]",
      "[::1]:1300",
    ]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
    for (const host of [
      "192.168.0.4:1300",
      "deixa.local",
      "localhost.evil.com",
      "[fe80::1]:1300",
      "",
      null,
      undefined,
    ]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });

  it("exige o salto de loopback e o host local ao mesmo tempo", () => {
    expect(isLoopbackRequest({ forwardedFor: "127.0.0.1", host: "localhost:1300" })).toBe(true);
    expect(isLoopbackRequest({ forwardedFor: "127.0.0.1", host: "192.168.0.4:1300" })).toBe(false);
    expect(isLoopbackRequest({ forwardedFor: "192.168.0.10", host: "localhost:1300" })).toBe(false);
    expect(isLoopbackRequest({ forwardedFor: null, host: "localhost" })).toBe(false);
  });
});
