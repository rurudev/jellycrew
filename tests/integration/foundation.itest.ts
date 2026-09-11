import { describe, expect, it } from "vitest";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/db/schema";
import { JELLYFIN_TARGET_VERSION } from "@/lib/jellyfin/version";
import { fetchUsers } from "@/lib/jellyfin";
import { ensureDeviceId } from "@/lib/settings";
import { recordAudit } from "@/lib/services/audit";
import { LoginError, loginAdmin } from "@/lib/services/auth";
import { getHealth } from "@/lib/services/system";
import { GET as healthz } from "@/app/healthz/route";
import { createRawUser, deleteRawUser, testServer, uniqueName } from "./helpers";
import spec from "@/lib/jellyfin/openapi.json";

describe("foundation", () => {
  it("logs in as admin with Jellyfin admin credentials", async () => {
    const jf = testServer();
    const identity = await loginAdmin(jf.admin.name, jf.admin.password);
    expect(identity.userId).toBe(jf.admin.id);
    expect(identity.isAdministrator).toBe(true);
    const last = getDb().select().from(audit).orderBy(desc(audit.id)).limit(1).get();
    expect(last?.action).toBe("admin.login");
    expect(last?.actorType).toBe("admin");
    expect(last?.actorId).toBe(jf.admin.id);
  });

  it("rejects wrong passwords", async () => {
    const jf = testServer();
    await expect(loginAdmin(jf.admin.name, "definitely-wrong")).rejects.toMatchObject({ code: "invalid_credentials" });
  });

  it("rejects non-administrators", async () => {
    const user = await createRawUser(uniqueName("plain"));
    try {
      await expect(loginAdmin(user.name, user.password)).rejects.toBeInstanceOf(LoginError);
      await expect(loginAdmin(user.name, user.password)).rejects.toMatchObject({ code: "not_admin" });
    } finally {
      await deleteRawUser(user.id);
    }
  });

  it("lists users from the fresh container", async () => {
    const users = await fetchUsers();
    const names = users.map((u) => u.Name);
    expect(names).toContain(testServer().admin.name);
    const admin = users.find((u) => u.Id === testServer().admin.id);
    expect(admin?.Policy?.IsAdministrator).toBe(true);
  });

  it("healthz reports the Jellyfin version", async () => {
    const res = await healthz();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.jellyfin.reachable).toBe(true);
    expect(body.jellyfin.version).toBe(JELLYFIN_TARGET_VERSION);
    expect(body.jellyfin.compatible).toBe(true);
    expect(body.jellyfin.serverName).toBe("jellycrew-test");
    expect(body.database.ok).toBe(true);
    const health = await getHealth();
    expect(health.app.name).toBe("jellycrew");
  });

  it("keeps a stable device id in the setting table", () => {
    const a = ensureDeviceId();
    const b = ensureDeviceId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });

  it("records audit rows with before/after and request id", () => {
    const row = recordAudit({
      actor: { type: "system", id: null, requestId: "req-1" },
      action: "test.action",
      targetUserId: "u1",
      before: { a: 1 },
      after: { a: 2 },
    });
    expect(row.id).toBeGreaterThan(0);
    expect(row.requestId).toBe("req-1");
    expect(row.before).toEqual({ a: 1 });
    expect(row.after).toEqual({ a: 2 });
  });

  it("serves an OpenAPI spec whose UserPolicy matches the committed snapshot", async () => {
    const res = await fetch(`${testServer().url}/api-docs/openapi.json`);
    expect(res.ok).toBe(true);
    const live = (await res.json()) as typeof spec;
    expect(live.info.version).toBe(JELLYFIN_TARGET_VERSION);
    const liveKeys = Object.keys(live.components.schemas.UserPolicy.properties).sort();
    const snapshotKeys = Object.keys(spec.components.schemas.UserPolicy.properties).sort();
    expect(liveKeys).toEqual(snapshotKeys);
  });
});
