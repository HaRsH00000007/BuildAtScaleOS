import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES } from "./permissions";

// The first migration inserts the default roles; it must match DEFAULT_ROLES.
describe("default roles in the init migration", () => {
  const sql = readFileSync(path.resolve(__dirname, "../../prisma/migrations/20261029120000_init/migration.sql"), "utf8");
  const rows = [...sql.matchAll(/\('role_\w+', '([^']+)', '[^']*', ARRAY\[([^\]]*)\]/g)].map((m) => ({ name: m[1]!, permissions: [...m[2]!.matchAll(/'([^']+)'/g)].map((p) => p[1]) }));
  it("inserts every default role with the same permissions", () => {
    expect(rows.map((r) => r.name).sort()).toEqual(Object.keys(DEFAULT_ROLES).sort());
    for (const r of rows) expect(r.permissions).toEqual(DEFAULT_ROLES[r.name]!.permissions);
  });
});
