import { describe, expect, it } from "vitest";
import spec from "@/lib/jellyfin/openapi.json";
import { POLICY_FIELDS, POLICY_FIELD_BY_KEY, POLICY_GROUPS } from "./fields";

const schemaKeys = Object.keys(spec.components.schemas.UserPolicy.properties).sort();

describe("policy field catalog", () => {
  it("covers every UserPolicy field in the OpenAPI spec exactly once", () => {
    const catalogKeys = POLICY_FIELDS.map((f) => f.key).sort();
    expect(catalogKeys).toEqual(schemaKeys);
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
  });

  it("has no catalog entries that the spec does not know", () => {
    for (const f of POLICY_FIELDS) expect(schemaKeys).toContain(f.key);
  });

  it("puts every field in a defined group with label and help", () => {
    const groupIds = new Set(POLICY_GROUPS.map((g) => g.id));
    for (const f of POLICY_FIELDS) {
      expect(groupIds.has(f.group)).toBe(true);
      expect(f.label.length).toBeGreaterThan(2);
      expect(f.help.length).toBeGreaterThan(5);
      expect(POLICY_FIELD_BY_KEY.get(f.key)).toBe(f);
    }
  });
});
