import { PROFILE_MANAGED_FIELDS } from "./fields";

/**
 * Jellyfin 10.11's policy for a freshly created user, restricted to profile-managed
 * fields. Used for "blank" profiles. An integration test compares this with a real
 * new user so a Jellyfin upgrade that changes defaults is noticed.
 */
export const JELLYFIN_DEFAULT_MANAGED_POLICY: Record<string, unknown> = {
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
};

for (const key of PROFILE_MANAGED_FIELDS) {
  if (!(key in JELLYFIN_DEFAULT_MANAGED_POLICY)) throw new Error(`default policy is missing managed field ${key}`);
}
