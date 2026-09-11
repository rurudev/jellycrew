import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 128-bit random token, base64url (22 chars). Only its SHA-256 is stored. */
export function generateToken(): string {
  return randomBytes(16).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time comparison of two hex hashes. */
export function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function isTokenShaped(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}
