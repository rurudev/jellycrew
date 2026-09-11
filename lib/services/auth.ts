import { JellyfinError, authenticateByName, logoutSession } from "@/lib/jellyfin";
import { logger } from "@/lib/log";
import { recordAudit, type Actor } from "./audit";

export class LoginError extends Error {
  readonly code: "invalid_credentials" | "not_admin" | "disabled" | "unavailable";
  constructor(code: LoginError["code"], message: string) {
    super(message);
    this.name = "LoginError";
    this.code = code;
  }
}

export interface VerifiedIdentity {
  userId: string;
  userName: string;
  isAdministrator: boolean;
  isDisabled: boolean;
}

/**
 * Verifies Jellyfin credentials and returns the identity. The session token Jellyfin
 * creates for the check is logged out again immediately; the app never keeps user tokens.
 */
export async function verifyCredentials(username: string, password: string): Promise<VerifiedIdentity> {
  let result;
  try {
    result = await authenticateByName(username, password);
  } catch (err) {
    // Jellyfin answers 403 for disabled accounts (whatever the password) and 401 otherwise.
    if (err instanceof JellyfinError && err.status === 403) {
      throw new LoginError("disabled", "This account is disabled.");
    }
    if (err instanceof JellyfinError && err.status === 401) {
      throw new LoginError("invalid_credentials", "Invalid username or password.");
    }
    logger.error({ err }, "authentication request failed");
    throw new LoginError("unavailable", "Jellyfin could not be reached. Try again later.");
  }
  // The check created a Jellyfin session; end it so the app never holds user tokens.
  await logoutSession(result.AccessToken).catch((err) => logger.warn({ err }, "could not end verification session"));
  const policy = result.User.Policy;
  return {
    userId: result.User.Id,
    userName: result.User.Name ?? username,
    isAdministrator: policy?.IsAdministrator ?? false,
    isDisabled: policy?.IsDisabled ?? false,
  };
}

/** Admin login: Jellyfin credentials, and the account must be an administrator. */
export async function loginAdmin(username: string, password: string, requestId?: string): Promise<VerifiedIdentity> {
  const identity = await verifyCredentials(username, password);
  const actor: Actor = { type: "admin", id: identity.userId, requestId };
  if (!identity.isAdministrator) {
    recordAudit({ actor, action: "admin.login.denied", targetUserId: identity.userId, detail: { reason: "not_admin" } });
    throw new LoginError("not_admin", "This account is not a Jellyfin administrator.");
  }
  recordAudit({ actor, action: "admin.login", targetUserId: identity.userId });
  return identity;
}
