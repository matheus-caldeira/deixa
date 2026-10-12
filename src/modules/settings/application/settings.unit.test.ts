import { describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { canonicalServiceUrl, mergeSettings, type AppSettings, type SettingKey } from "../domain/settings";
import { makeGetSettings, makeUpdateSettings, type SettingsRepository } from "./settings-use-cases";

const defaults: AppSettings = {
  geminiModel: "gemini-2.5-flash",
  subtitleDownloadsPerUserPerDay: 10,
  kokoroUrl: null,
};
const admin = { userId: "dono", isAdmin: true };

function setup(stored: Partial<Record<SettingKey, unknown>> = {}) {
  const saved: { values: AppSettings; updatedBy: string }[] = [];
  const settings: SettingsRepository = {
    load: async () => stored,
    save: async (values, updatedBy) => {
      saved.push({ values, updatedBy });
      Object.assign(stored, values);
    },
  };
  const deps = { settings, defaults, clock: new FixedClock("2026-10-12T12:00:00Z") };
  return { saved, get: makeGetSettings(deps), update: makeUpdateSettings(deps) };
}

describe("configurações do servidor", () => {
  it("sem nada guardado valem os padrões; valor guardado vence; valor inválido guardado é ignorado", async () => {
    expect(await setup().get()).toEqual(defaults);
    expect(await setup({ subtitleDownloadsPerUserPerDay: 100 }).get()).toMatchObject({
      geminiModel: "gemini-2.5-flash",
      subtitleDownloadsPerUserPerDay: 100,
    });
    expect(mergeSettings(defaults, { geminiModel: "Modelo Inválido!", kokoroUrl: "ftp://x" })).toEqual(
      defaults,
    );
  });

  it("só o administrador altera, e o que ele salva passa a valer", async () => {
    const app = setup();
    const values = { ...defaults, geminiModel: "gemini-flash-latest", kokoroUrl: "http://localhost:1881" };
    await expect(app.update({ actor: { userId: "ana", isAdmin: false }, values })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(app.saved).toEqual([]);
    expect(await app.update({ actor: admin, values })).toEqual(values);
    expect(app.saved).toEqual([{ values, updatedBy: "dono" }]);
    expect(await app.get()).toEqual(values);
  });

  it("guarda o endereço do Kokoro na forma canônica, que é a mesma usada para conectar", async () => {
    const app = setup();
    const saved = await app.update({
      actor: admin,
      values: { ...defaults, kokoroUrl: "  HTTP://LocalHost:1881/api/// " },
    });
    expect(saved.kokoroUrl).toBe("http://localhost:1881/api");
    expect(canonicalServiceUrl("http://[::1]:1881")).toBe("http://[::1]:1881");
    expect(canonicalServiceUrl("http://192.168.1.20:1881/")).toBe("http://192.168.1.20:1881");
    expect(canonicalServiceUrl("http://kokoro.local.:1881")).toBe("http://kokoro.local:1881");
  });

  it("recusa modelo fora do formato, quantidade fora da faixa e endereço que não é http", async () => {
    const app = setup();
    for (const values of [
      { ...defaults, geminiModel: "x" },
      { ...defaults, subtitleDownloadsPerUserPerDay: -1 },
      { ...defaults, subtitleDownloadsPerUserPerDay: 1001 },
      { ...defaults, subtitleDownloadsPerUserPerDay: 2.5 },
      { ...defaults, kokoroUrl: "file:///etc/passwd" },
      { ...defaults, kokoroUrl: "localhost:1881" },
      { ...defaults, kokoroUrl: "http://169.254.169.254/latest/meta-data" },
      { ...defaults, kokoroUrl: "http://usuario:senha@localhost:1881" },
      { ...defaults, kokoroUrl: "http://localhost:1881/?alvo=outro" },
      { ...defaults, kokoroUrl: "http://0.0.0.0:1881" },
      { ...defaults, kokoroUrl: "http://2852039166/" },
      { ...defaults, kokoroUrl: "http://0xa9.0xfe.0xa9.0xfe/" },
      { ...defaults, kokoroUrl: "http://[::ffff:169.254.169.254]/" },
      { ...defaults, kokoroUrl: "http://[fe80::1]:1881" },
      { ...defaults, kokoroUrl: "http://metadata.google.internal./" },
      { ...defaults, kokoroUrl: "http://169.254.169.254./" },
      { geminiModel: "gemini-2.5-flash" },
    ]) {
      await expect(app.update({ actor: admin, values })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(app.saved).toEqual([]);
  });
});
