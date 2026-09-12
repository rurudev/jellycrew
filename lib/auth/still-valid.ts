import "server-only";
import { fetchUser } from "@/lib/jellyfin";
import { logger } from "@/lib/log";

/** How long an answer is reused before asking Jellyfin again. */
const CACHE_MS = 30_000;
type Kind = "admin" | "self";

interface Seen {
  ok: boolean;
  at: number;
}

declare global {
  var __jellycrewSessionChecks: Map<string, Seen> | undefined;
}

const seen: Map<string, Seen> = globalThis.__jellycrewSessionChecks ?? (globalThis.__jellycrewSessionChecks = new Map());

const wants: Record<Kind, (policy: { IsAdministrator?: boolean; IsDisabled?: boolean }) => boolean> = {
  admin: (policy) => policy.IsAdministrator === true && policy.IsDisabled !== true,
  self: (policy) => policy.IsDisabled !== true,
};

/** Forgets what is known about a user, so the next check asks Jellyfin again. */
export function forgetSessionCheck(userId: string): void {
  for (const kind of Object.keys(wants) as Kind[]) seen.delete(`${kind}:${userId}`);
}

async function check(kind: Kind, userId: string): Promise<boolean> {
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const cached = seen.get(key);
  if (cached && now - cached.at < CACHE_MS) return cached.ok;
  try {
    const user = await fetchUser(userId);
    const ok = wants[kind](user.Policy ?? {});
    seen.set(key, { ok, at: now });
    return ok;
  } catch (err) {
    // A 404 is an answer: the account is gone, so the session goes with it.
    const status = err instanceof Error && "status" in err ? (err as { status?: number }).status : undefined;
    if (status === 404) {
      seen.set(key, { ok: false, at: now });
      return false;
    }
    // Anything else means Jellyfin could not be reached, and the answer is unknown. Refusing
    // here would sign every administrator out whenever Jellyfin restarts, including on a cold
    // process where nothing is cached, and sign-in needs Jellyfin too, so there would be no way
    // back in. Nothing can be changed while Jellyfin is down either: every write goes through
    // it. The session is therefore kept, and the outage is logged. Nothing is cached, so the
    // next request asks again.
    logger.warn({ userId, kind, err }, "could not re-check the session against Jellyfin; keeping it until Jellyfin answers");
    return true;
  }
}

/**
 * Is this session still an administrator? The cookie says who signed in, not what they may do
 * now: demote or delete the account in Jellyfin and the cookie would otherwise keep full
 * authority until it expires.
 */
export function isStillAdmin(userId: string): Promise<boolean> {
  return check("admin", userId);
}

/** Is this account still able to use self-service? A disabled one is not. */
export function isStillActiveUser(userId: string): Promise<boolean> {
  return check("self", userId);
}
