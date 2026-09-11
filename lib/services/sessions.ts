import { JellyfinError, fetchSessions, sendMessageCommand, sendPlaystateCommand } from "@/lib/jellyfin";
import { ensureDeviceId } from "@/lib/settings";
import { toSessionView, type SessionView } from "@/lib/sessions/view";
import { recordAudit, type Actor } from "./audit";

/** The only Jellyfin data cached across requests: the session list, for 10 seconds. */
export const SESSION_CACHE_TTL_MS = 10_000;

interface Cache {
  at: number;
  sessions: SessionView[];
}

declare global {
  var __jellycrewSessionCache: Cache | undefined;
}

export function invalidateSessionCache(): void {
  globalThis.__jellycrewSessionCache = undefined;
}

/** Live sessions, excluding the app's own API-key session. */
export async function listSessions(opts: { fresh?: boolean } = {}): Promise<SessionView[]> {
  const cache = globalThis.__jellycrewSessionCache;
  if (!opts.fresh && cache && Date.now() - cache.at < SESSION_CACHE_TTL_MS) return cache.sessions;
  const ownDevice = ensureDeviceId();
  const raw = await fetchSessions();
  const sessions = raw
    .map(toSessionView)
    .filter((s) => s.id && s.deviceId !== ownDevice && s.userId !== null)
    .sort((a, b) => (b.lastActivity?.getTime() ?? 0) - (a.lastActivity?.getTime() ?? 0));
  globalThis.__jellycrewSessionCache = { at: Date.now(), sessions };
  return sessions;
}

export async function sessionsForUser(userId: string, opts: { fresh?: boolean } = {}): Promise<SessionView[]> {
  return (await listSessions(opts)).filter((s) => s.userId === userId);
}

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} no longer exists.`);
    this.name = "SessionNotFoundError";
  }
}

async function findSession(sessionId: string): Promise<SessionView | undefined> {
  return (await listSessions()).find((s) => s.id === sessionId);
}

export async function stopPlayback(actor: Actor, sessionId: string): Promise<void> {
  const session = await findSession(sessionId);
  try {
    await sendPlaystateCommand(sessionId, "Stop");
  } catch (err) {
    if (err instanceof JellyfinError && err.status === 404) throw new SessionNotFoundError(sessionId);
    throw err;
  }
  recordAudit({
    actor,
    action: "session.stop",
    targetUserId: session?.userId ?? null,
    detail: { sessionId, client: session?.client, device: session?.deviceName, nowPlaying: session?.nowPlaying?.title },
  });
  invalidateSessionCache();
}

export async function sendSessionMessage(actor: Actor, sessionId: string, message: { text: string; header?: string; timeoutMs?: number }): Promise<void> {
  const session = await findSession(sessionId);
  try {
    await sendMessageCommand(sessionId, message);
  } catch (err) {
    if (err instanceof JellyfinError && err.status === 404) throw new SessionNotFoundError(sessionId);
    throw err;
  }
  recordAudit({
    actor,
    action: "session.message",
    targetUserId: session?.userId ?? null,
    detail: { sessionId, client: session?.client, device: session?.deviceName, header: message.header ?? null, text: message.text },
  });
}
