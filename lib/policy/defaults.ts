import { POLICY_FIELDS, PROFILE_MANAGED_FIELDS } from "./fields";

/**
 * Jellyfin 10.11's policy for a freshly created user, for every catalogued field. The
 * profile-managed subset seeds "blank" profiles; the whole map tells the user page which
 * fields are worth surfacing. An integration test compares this with a real new user so a
 * Jellyfin upgrade that changes defaults is noticed.
 */
export const JELLYFIN_DEFAULT_POLICY: Record<string, unknown> = {
  // Profile-managed
  EnableAllFolders: true,
  EnabledFolders: [],
  BlockedMediaFolders: [],
  EnableAllChannels: true,
  EnabledChannels: [],
  BlockedChannels: [],
  MaxParentalRating: null,
  MaxParentalSubRating: null,
  BlockedTags: [],
  AllowedTags: [],
  BlockUnratedItems: [],
  AccessSchedules: [],
  EnableMediaPlayback: true,
  EnableAudioPlaybackTranscoding: true,
  EnableVideoPlaybackTranscoding: true,
  EnablePlaybackRemuxing: true,
  ForceRemoteSourceTranscoding: false,
  EnableContentDownloading: true,
  EnableMediaConversion: true,
  EnableSyncTranscoding: true,
  SyncPlayAccess: "CreateAndJoinGroups",
  EnableRemoteAccess: true,
  RemoteClientBitrateLimit: 0,
  MaxActiveSessions: 0,
  EnableLiveTvAccess: true,
  EnableLiveTvManagement: false,
  EnableContentDeletion: false,
  EnableContentDeletionFromFolders: [],
  EnableCollectionManagement: false,
  EnableSubtitleManagement: false,
  EnableLyricManagement: false,
  EnableUserPreferenceAccess: true,
  EnablePublicSharing: true,
  EnableRemoteControlOfOtherUsers: false,
  EnableSharedDeviceControl: true,
  // Per-user
  IsAdministrator: false,
  IsDisabled: false,
  IsHidden: true,
  EnableAllDevices: true,
  EnabledDevices: [],
  AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
  PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
  InvalidLoginAttemptCount: 0,
  LoginAttemptsBeforeLockout: -1,
};

for (const f of POLICY_FIELDS) {
  if (!(f.key in JELLYFIN_DEFAULT_POLICY)) throw new Error(`default policy is missing field ${f.key}`);
}

/** The profile-managed subset: what a "blank" profile starts from. */
export const JELLYFIN_DEFAULT_MANAGED_POLICY: Record<string, unknown> = Object.fromEntries(PROFILE_MANAGED_FIELDS.map((key) => [key, JELLYFIN_DEFAULT_POLICY[key]]));
