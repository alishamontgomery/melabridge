import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260915090000_prevent_duplicate_vendor_inquiries.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("duplicate vendor inquiry migration", () => {
  it("serializes concurrent submissions for the planner and vendor pair", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "md5(v_vendor.user_id::text || '|' || v_caller::text)",
    );
  });

  it("only blocks established active inquiry statuses", () => {
    const activeStatusChecks = migration.match(
      /status IN \('pending', 'alternate_proposed', 'approved'\)/g,
    );

    expect(activeStatusChecks).toHaveLength(2);
    expect(migration).not.toMatch(/status\s*<>\s*'cancelled'/);
  });

  it("preserves authorization and inquiry calendar windows", () => {
    expect(migration).toContain("FROM public.user_roles");
    expect(migration).toContain(
      "p.account_type IN ('personal', 'organization', 'admin')",
    );
    expect(migration).toContain("T12:00:00Z");
    expect(migration).toContain("T20:00:00Z");
  });
});