/**
 * Catalog of every UserPolicy field: how it is grouped and rendered, and whether a
 * profile manages it (`scope: "profile"`) or it belongs to the individual user
 * (`scope: "user"`). A test asserts the catalog covers the OpenAPI schema exactly.
 */
export type PolicyGroupId =
  | "libraries"
  | "parental"
  | "playback"
  | "remote"
  | "livetv"
  | "content"
  | "permissions"
  | "devices"
  | "admin"
  | "auth";

export type PolicyFieldKind =
  | "boolean"
  | "integer"
  | "string"
  | "stringList"
  | "folderIds"
  | "channelIds"
  | "deviceIds"
  | "rating"
  | "unratedItems"
  | "schedules"
  | "syncPlayAccess";

export type PolicyScope = "profile" | "user";

export interface PolicyFieldDef {
  key: string;
  label: string;
  help: string;
  group: PolicyGroupId;
  kind: PolicyFieldKind;
  scope: PolicyScope;
  /** Shown in the editor only under "advanced". */
  advanced?: boolean;
}

export interface PolicyGroupDef {
  id: PolicyGroupId;
  title: string;
  description: string;
}

export const POLICY_GROUPS: PolicyGroupDef[] = [
  { id: "libraries", title: "Libraries", description: "Which media folders and channels the user can see." },
  { id: "parental", title: "Parental controls", description: "Rating limits, tag filters and access hours." },
  { id: "playback", title: "Playback", description: "Playback, transcoding, downloads and SyncPlay." },
  { id: "remote", title: "Remote access", description: "Access from outside the local network and session limits." },
  { id: "livetv", title: "Live TV", description: "Live TV viewing and recording management." },
  { id: "content", title: "Content management", description: "Deleting media and managing collections, subtitles and lyrics." },
  { id: "permissions", title: "Other permissions", description: "Sharing, preferences and remote control of other sessions." },
  { id: "devices", title: "Devices", description: "Which devices this user may sign in from." },
  { id: "admin", title: "Administration and danger zone", description: "Administrator rights, hiding and disabling the account." },
  { id: "auth", title: "Authentication", description: "Providers and lockout counters. Rarely changed." },
];

export const SYNC_PLAY_ACCESS_VALUES = ["CreateAndJoinGroups", "JoinGroups", "None"] as const;
export const UNRATED_ITEM_VALUES = ["Movie", "Trailer", "Series", "Music", "Book", "LiveTvChannel", "LiveTvProgram", "ChannelContent", "Other"] as const;
export const DAY_OF_WEEK_VALUES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Everyday", "Weekday", "Weekend"] as const;

const P = "profile" as const;
const U = "user" as const;

export const POLICY_FIELDS: PolicyFieldDef[] = [
  // Libraries
  { key: "EnableAllFolders", label: "Access to all libraries", help: "When on, the user sees every library, including ones added later.", group: "libraries", kind: "boolean", scope: P },
  { key: "EnabledFolders", label: "Allowed libraries", help: "Libraries the user may access when 'all libraries' is off.", group: "libraries", kind: "folderIds", scope: P },
  { key: "BlockedMediaFolders", label: "Blocked libraries", help: "Libraries explicitly hidden from the user.", group: "libraries", kind: "folderIds", scope: P, advanced: true },
  { key: "EnableAllChannels", label: "Access to all channels", help: "Plugin channels (podcasts, internet media). When on, every channel is visible.", group: "libraries", kind: "boolean", scope: P, advanced: true },
  { key: "EnabledChannels", label: "Allowed channels", help: "Channel ids the user may access when 'all channels' is off.", group: "libraries", kind: "channelIds", scope: P, advanced: true },
  { key: "BlockedChannels", label: "Blocked channels", help: "Channel ids explicitly hidden from the user.", group: "libraries", kind: "channelIds", scope: P, advanced: true },
  // Parental
  { key: "MaxParentalRating", label: "Maximum parental rating", help: "Items rated above this score are hidden. Uses the server's rating list.", group: "parental", kind: "rating", scope: P },
  { key: "MaxParentalSubRating", label: "Maximum parental sub-rating", help: "Secondary rating threshold used by some rating systems (for example TV-Y7-FV).", group: "parental", kind: "integer", scope: P, advanced: true },
  { key: "BlockedTags", label: "Blocked tags", help: "Items carrying any of these tags are hidden.", group: "parental", kind: "stringList", scope: P },
  { key: "AllowedTags", label: "Allowed tags", help: "When set, only items carrying one of these tags are visible.", group: "parental", kind: "stringList", scope: P },
  { key: "BlockUnratedItems", label: "Block unrated items", help: "Hide items of these types when they carry no rating.", group: "parental", kind: "unratedItems", scope: P },
  { key: "AccessSchedules", label: "Access schedules", help: "Hours during which the user may sign in. Empty means always.", group: "parental", kind: "schedules", scope: P },
  // Playback
  { key: "EnableMediaPlayback", label: "Media playback", help: "Allow playing media at all. Off turns the account into browse-only.", group: "playback", kind: "boolean", scope: P },
  { key: "EnableAudioPlaybackTranscoding", label: "Audio transcoding", help: "Allow the server to transcode audio when the client cannot play it directly.", group: "playback", kind: "boolean", scope: P },
  { key: "EnableVideoPlaybackTranscoding", label: "Video transcoding", help: "Allow the server to transcode video. Transcoding is CPU/GPU intensive.", group: "playback", kind: "boolean", scope: P },
  { key: "EnablePlaybackRemuxing", label: "Remuxing", help: "Allow repackaging streams into another container without re-encoding.", group: "playback", kind: "boolean", scope: P },
  { key: "ForceRemoteSourceTranscoding", label: "Force transcoding of remote sources", help: "Always transcode internet streams (live TV, channels) instead of passing them through.", group: "playback", kind: "boolean", scope: P, advanced: true },
  { key: "EnableContentDownloading", label: "Downloads", help: "Allow downloading original files to the client.", group: "playback", kind: "boolean", scope: P },
  { key: "EnableMediaConversion", label: "Media conversion", help: "Allow the user to queue conversions of media into other formats.", group: "playback", kind: "boolean", scope: P },
  { key: "EnableSyncTranscoding", label: "Sync transcoding", help: "Allow transcoding for offline sync jobs.", group: "playback", kind: "boolean", scope: P, advanced: true },
  { key: "SyncPlayAccess", label: "SyncPlay", help: "Whether the user can create and join watch-together groups.", group: "playback", kind: "syncPlayAccess", scope: P },
  // Remote
  { key: "EnableRemoteAccess", label: "Remote access", help: "Allow connections from outside the local network.", group: "remote", kind: "boolean", scope: P },
  { key: "RemoteClientBitrateLimit", label: "Remote bitrate limit", help: "Maximum bitrate for remote streams in bits per second. 0 means no limit.", group: "remote", kind: "integer", scope: P },
  { key: "MaxActiveSessions", label: "Maximum active sessions", help: "How many simultaneous sessions the user may have. 0 means unlimited.", group: "remote", kind: "integer", scope: P },
  // Live TV
  { key: "EnableLiveTvAccess", label: "Live TV access", help: "Allow watching live TV.", group: "livetv", kind: "boolean", scope: P },
  { key: "EnableLiveTvManagement", label: "Live TV management", help: "Allow scheduling recordings and managing tuners.", group: "livetv", kind: "boolean", scope: P },
  // Content management
  { key: "EnableContentDeletion", label: "Delete media", help: "Allow deleting items from any library.", group: "content", kind: "boolean", scope: P },
  { key: "EnableContentDeletionFromFolders", label: "Delete media from specific libraries", help: "Libraries the user may delete from, when general deletion is off.", group: "content", kind: "folderIds", scope: P },
  { key: "EnableCollectionManagement", label: "Manage collections", help: "Allow creating and editing collections.", group: "content", kind: "boolean", scope: P },
  { key: "EnableSubtitleManagement", label: "Manage subtitles", help: "Allow uploading, downloading and deleting subtitles.", group: "content", kind: "boolean", scope: P },
  { key: "EnableLyricManagement", label: "Manage lyrics", help: "Allow uploading, downloading and deleting lyrics.", group: "content", kind: "boolean", scope: P },
  // Other permissions
  { key: "EnableUserPreferenceAccess", label: "Edit own preferences", help: "Allow the user to change their own display and playback preferences.", group: "permissions", kind: "boolean", scope: P },
  { key: "EnablePublicSharing", label: "Public sharing", help: "Allow creating public share links (if a sharing plugin is installed).", group: "permissions", kind: "boolean", scope: P },
  { key: "EnableRemoteControlOfOtherUsers", label: "Control other users' sessions", help: "Allow remote-controlling sessions that belong to other users.", group: "permissions", kind: "boolean", scope: P },
  { key: "EnableSharedDeviceControl", label: "Control shared devices", help: "Allow remote-controlling devices that are not signed in as this user.", group: "permissions", kind: "boolean", scope: P },
  // Devices
  { key: "EnableAllDevices", label: "Sign in from any device", help: "When off, only the devices in the allowlist below may be used.", group: "devices", kind: "boolean", scope: U },
  { key: "EnabledDevices", label: "Allowed devices", help: "Device allowlist, by device id. Names are resolved from the server's device list.", group: "devices", kind: "deviceIds", scope: U },
  // Admin
  { key: "IsAdministrator", label: "Administrator", help: "Full control over the server. Administrators are excluded from all automation.", group: "admin", kind: "boolean", scope: U },
  { key: "IsHidden", label: "Hidden from login screen", help: "Do not show this user on the sign-in page.", group: "admin", kind: "boolean", scope: U },
  { key: "IsDisabled", label: "Disabled", help: "The user cannot sign in. Existing sessions end.", group: "admin", kind: "boolean", scope: U },
  // Auth
  { key: "AuthenticationProviderId", label: "Authentication provider", help: "Plugin that validates this user's password.", group: "auth", kind: "string", scope: U, advanced: true },
  { key: "PasswordResetProviderId", label: "Password reset provider", help: "Plugin that handles Jellyfin's own forgot-password flow.", group: "auth", kind: "string", scope: U, advanced: true },
  { key: "LoginAttemptsBeforeLockout", label: "Login attempts before lockout", help: "-1 uses the server default; 0 disables lockout.", group: "auth", kind: "integer", scope: U, advanced: true },
  { key: "InvalidLoginAttemptCount", label: "Failed login attempts", help: "Current counter. Reset by Jellyfin on a successful login.", group: "auth", kind: "integer", scope: U, advanced: true },
];

export const POLICY_FIELD_BY_KEY: ReadonlyMap<string, PolicyFieldDef> = new Map(POLICY_FIELDS.map((f) => [f.key, f]));

export const PROFILE_MANAGED_FIELDS: readonly string[] = POLICY_FIELDS.filter((f) => f.scope === "profile").map((f) => f.key);
export const PER_USER_FIELDS: readonly string[] = POLICY_FIELDS.filter((f) => f.scope === "user").map((f) => f.key);

export function fieldsInGroup(group: PolicyGroupId): PolicyFieldDef[] {
  return POLICY_FIELDS.filter((f) => f.group === group);
}
