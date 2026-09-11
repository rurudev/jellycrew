import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { token as tokenTable, type Token, type TokenCreator, type TokenKind } from "@/lib/db/schema";
import { generateToken, hashToken, hashesEqual, isTokenShaped } from "@/lib/tokens";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Issues a single-use token. Older unused tokens of the same kind for the user are
 * invalidated so only the newest link works.
 */
export function issueToken(input: { kind: TokenKind; userId: string; createdBy: TokenCreator; ttlMs: number; email?: string | null; now?: Date }): { token: string; row: Token } {
  const now = input.now ?? new Date();
  const db = getDb();
  db.update(tokenTable)
    .set({ usedAt: now })
    .where(and(eq(tokenTable.kind, input.kind), eq(tokenTable.jellyfinUserId, input.userId), isNull(tokenTable.usedAt)))
    .run();
  const token = generateToken();
  const row = db
    .insert(tokenTable)
    .values({
      id: randomUUID(),
      kind: input.kind,
      jellyfinUserId: input.userId,
      tokenHash: hashToken(token),
      email: input.email ?? null,
      expiresAt: new Date(now.getTime() + input.ttlMs),
      usedAt: null,
      createdBy: input.createdBy,
      createdAt: now,
    })
    .returning()
    .get();
  return { token, row };
}

export type ConsumeResult = { ok: true; row: Token } | { ok: false; reason: "invalid" | "used" | "expired" };

/** Looks the token up without consuming it (for rendering the reset form). */
export function peekToken(kind: TokenKind, token: string, now: Date = new Date()): ConsumeResult {
  if (!isTokenShaped(token)) return { ok: false, reason: "invalid" };
  const hash = hashToken(token);
  const row = getDb().select().from(tokenTable).where(and(eq(tokenTable.tokenHash, hash), eq(tokenTable.kind, kind))).get();
  if (!row || !hashesEqual(row.tokenHash, hash)) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true, row };
}

/** Consumes a token atomically: the UPDATE only succeeds for an unused, unexpired row. */
export function consumeToken(kind: TokenKind, token: string, now: Date = new Date()): ConsumeResult {
  const peek = peekToken(kind, token, now);
  if (!peek.ok) return peek;
  const claimed = getDb()
    .update(tokenTable)
    .set({ usedAt: now })
    .where(and(eq(tokenTable.id, peek.row.id), isNull(tokenTable.usedAt)))
    .returning()
    .get();
  if (!claimed) return { ok: false, reason: "used" };
  return { ok: true, row: claimed };
}
