import { describe, expect, it } from "vitest";
import { EMBEDDED_MIGRATIONS } from "./apply-migrations";
import { readMigrations } from "./read-migrations";

describe("migrações embutidas", () => {
  it("acompanham a pasta de migrações; rode pnpm db:generate depois de criar uma", () => {
    expect(EMBEDDED_MIGRATIONS).toEqual(readMigrations());
  });
});
