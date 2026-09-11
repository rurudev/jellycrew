import type { UserMeta } from "@/lib/db/schema";
import type { UserStatus } from "./status";

/** One row of the users table: Jellyfin data merged with app metadata and live counts. */
export interface UserRow {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  isHidden: boolean;
  imageTag: string | null;
  status: UserStatus;
  profileId: string | null;
  profileName: string | null;
  /** null when unknown (no profile assigned). */
  drift: boolean | null;
  lastLogin: Date | null;
  lastActivity: Date | null;
  /** Date inactivity is measured from. */
  activityBasis: Date;
  activeSessions: number;
  deviceCount: number;
  expiresAt: Date | null;
  labels: string[];
  meta: UserMeta;
}
