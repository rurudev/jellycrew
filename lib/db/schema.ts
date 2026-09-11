import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

export type DisabledReason = "expired" | "inactive" | "manual";
export type ActorType = "admin" | "self" | "system" | "invite";
export type TokenKind = "password_reset" | "email_verify";
export type TokenCreator = "self" | "admin";

export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  /** Profile-managed UserPolicy fields only. */
  policy: text("policy", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  defaultExpiryDays: integer("default_expiry_days"),
  inactivityDisableDays: integer("inactivity_disable_days"),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const userMeta = sqliteTable(
  "user_meta",
  {
    jellyfinUserId: text("jellyfin_user_id").primaryKey(),
    email: text("email"),
    emailVerifiedAt: ts("email_verified_at"),
    notes: text("notes"),
    labels: text("labels", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    profileId: text("profile_id").references(() => profile.id, { onDelete: "set null" }),
    expiresAt: ts("expires_at"),
    /** null = inherit from profile; profile null = never. */
    inactivityDisableDays: integer("inactivity_disable_days"),
    disabledByAppAt: ts("disabled_by_app_at"),
    disabledReason: text("disabled_reason").$type<DisabledReason>(),
    deleteAfter: ts("delete_after"),
    createdViaInviteId: text("created_via_invite_id"),
    firstSeenAt: ts("first_seen_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("user_meta_profile_idx").on(t.profileId), index("user_meta_email_idx").on(t.email)],
);

export const invite = sqliteTable(
  "invite",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    /** The token sealed with SESSION_SECRET so admins can copy the link later; useless without the secret. */
    tokenSealed: text("token_sealed"),
    label: text("label"),
    profileId: text("profile_id").references(() => profile.id, { onDelete: "set null" }),
    expiresAt: ts("expires_at"),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    accountExpiryDays: integer("account_expiry_days"),
    requireEmail: integer("require_email", { mode: "boolean" }).notNull().default(false),
    noteForInvitee: text("note_for_invitee"),
    createdBy: text("created_by").notNull(),
    createdAt: ts("created_at").notNull(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [uniqueIndex("invite_token_hash_idx").on(t.tokenHash)],
);

export const inviteUse = sqliteTable(
  "invite_use",
  {
    id: text("id").primaryKey(),
    inviteId: text("invite_id")
      .notNull()
      .references(() => invite.id, { onDelete: "cascade" }),
    jellyfinUserId: text("jellyfin_user_id").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("invite_use_invite_idx").on(t.inviteId)],
);

export const token = sqliteTable(
  "token",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<TokenKind>().notNull(),
    jellyfinUserId: text("jellyfin_user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    /** For email_verify tokens: the address being verified. */
    email: text("email"),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdBy: text("created_by").$type<TokenCreator>().notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [uniqueIndex("token_hash_idx").on(t.tokenHash), index("token_user_idx").on(t.jellyfinUserId)],
);

export const audit = sqliteTable(
  "audit",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ts: ts("ts").notNull(),
    actorType: text("actor_type").$type<ActorType>().notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetUserId: text("target_user_id"),
    before: text("before", { mode: "json" }).$type<unknown>(),
    after: text("after", { mode: "json" }).$type<unknown>(),
    detail: text("detail", { mode: "json" }).$type<unknown>(),
    requestId: text("request_id"),
  },
  (t) => [
    index("audit_ts_idx").on(t.ts),
    index("audit_target_idx").on(t.targetUserId),
    index("audit_action_idx").on(t.action),
    index("audit_actor_idx").on(t.actorType, t.actorId),
  ],
);

export const jobRun = sqliteTable("job_run", {
  name: text("name").primaryKey(),
  lockUntil: ts("lock_until"),
  lastStartedAt: ts("last_started_at"),
  lastFinishedAt: ts("last_finished_at"),
  lastResult: text("last_result", { mode: "json" }).$type<unknown>(),
});

export const setting = sqliteTable("setting", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
});

export type Profile = typeof profile.$inferSelect;
export type UserMeta = typeof userMeta.$inferSelect;
export type Invite = typeof invite.$inferSelect;
export type InviteUse = typeof inviteUse.$inferSelect;
export type Token = typeof token.$inferSelect;
export type AuditRow = typeof audit.$inferSelect;
export type JobRun = typeof jobRun.$inferSelect;
