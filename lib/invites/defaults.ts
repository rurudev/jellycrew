/** How long an invite link stays valid. 0 means it never expires. */
export const LINK_EXPIRY_CHOICES = [7, 30, 0] as const;
/** How many accounts an invite may create. 0 means unlimited. */
export const USES_CHOICES = [1, 5, 0] as const;

export interface InviteLike {
  createdAt: Date;
  expiresAt: Date | null;
  maxUses: number | null;
  accountExpiryDays: number | null;
  requireEmail: boolean;
  profileId: string | null;
}

export interface InviteDefaults {
  profileId: string;
  /** Days, or 0 for never. Always one of the offered choices. */
  linkExpiryDays: number;
  /** Uses, or 0 for unlimited. Always one of the offered choices. */
  maxUses: number;
  /** Days as a form value; "" means the profile's own default. */
  accountExpiryDays: string;
  requireEmail: boolean;
  /** The choices to offer, including the one carried over when it is not a standard value. */
  linkExpiryChoices: number[];
  usesChoices: number[];
}

const DAY_MS = 86_400_000;

/** Whole days between creation and expiry, or 0 when the link never expires. */
export function linkExpiryDays(invite: InviteLike): number {
  if (!invite.expiresAt) return 0;
  const days = Math.round((invite.expiresAt.getTime() - invite.createdAt.getTime()) / DAY_MS);
  return days > 0 ? days : 0;
}

function withChoice(choices: readonly number[], value: number): number[] {
  return choices.includes(value) ? [...choices] : [value, ...choices];
}

/**
 * A new invite starts from the last one that was made: the same profile, validity, uses and
 * rules, because invites are handed out in batches to the same kind of guest. An unusual value
 * carried over stays offered so it is not silently rounded to a standard one.
 */
export function inviteDefaults(newest: InviteLike | undefined, profileIds: readonly string[]): InviteDefaults {
  if (!newest) {
    return { profileId: "", linkExpiryDays: 7, maxUses: 1, accountExpiryDays: "", requireEmail: false, linkExpiryChoices: [...LINK_EXPIRY_CHOICES], usesChoices: [...USES_CHOICES] };
  }
  const expiry = linkExpiryDays(newest);
  const uses = newest.maxUses ?? 0;
  return {
    profileId: newest.profileId && profileIds.includes(newest.profileId) ? newest.profileId : "",
    linkExpiryDays: expiry,
    maxUses: uses,
    accountExpiryDays: newest.accountExpiryDays === null ? "" : String(newest.accountExpiryDays),
    requireEmail: newest.requireEmail,
    linkExpiryChoices: withChoice(LINK_EXPIRY_CHOICES, expiry),
    usesChoices: withChoice(USES_CHOICES, uses),
  };
}
