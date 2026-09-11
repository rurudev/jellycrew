import { z } from "zod";
import type { components } from "./generated/schema";

/** Raw OpenAPI types, re-exported for the rest of the app. */
export type UserPolicy = components["schemas"]["UserPolicy"];
export type UserDto = components["schemas"]["UserDto"];
export type SystemInfo = components["schemas"]["SystemInfo"];
export type PublicSystemInfo = components["schemas"]["PublicSystemInfo"];
export type AuthenticationResult = components["schemas"]["AuthenticationResult"];

/**
 * Zod schemas for the parts of Jellyfin responses the app relies on. They are loose:
 * unknown fields pass through untouched so nothing is dropped on read-modify-write.
 */
export const UserPolicySchema = z.looseObject({
  IsAdministrator: z.boolean().default(false),
  IsDisabled: z.boolean().default(false),
  IsHidden: z.boolean().default(false),
});

export const UserDtoSchema = z.looseObject({
  Id: z.string().min(1),
  Name: z.string().nullable().optional(),
  HasPassword: z.boolean().optional(),
  PrimaryImageTag: z.string().nullable().optional(),
  LastLoginDate: z.string().nullable().optional(),
  LastActivityDate: z.string().nullable().optional(),
  Policy: UserPolicySchema.nullable().optional(),
});

export const UserListSchema = z.array(UserDtoSchema);

export const AuthenticationResultSchema = z.looseObject({
  AccessToken: z.string().min(1),
  User: UserDtoSchema,
  ServerId: z.string().nullable().optional(),
});

export const SystemInfoSchema = z.looseObject({
  ServerName: z.string().nullable().optional(),
  Version: z.string().nullable().optional(),
  Id: z.string().nullable().optional(),
  StartupWizardCompleted: z.boolean().nullable().optional(),
});

export const PublicSystemInfoSchema = SystemInfoSchema;

export type ValidatedUser = z.infer<typeof UserDtoSchema>;
export type ValidatedPolicy = z.infer<typeof UserPolicySchema>;
export type ValidatedSystemInfo = z.infer<typeof SystemInfoSchema>;
export type ValidatedAuthResult = z.infer<typeof AuthenticationResultSchema>;

export type SessionInfoDto = components["schemas"]["SessionInfoDto"];
export type DeviceInfoDto = components["schemas"]["DeviceInfoDto"];
export type PlayMethod = components["schemas"]["PlayMethod"];
export type PlaystateCommand = components["schemas"]["PlaystateCommand"];

export const NowPlayingItemSchema = z.looseObject({
  Id: z.string().optional(),
  Name: z.string().nullable().optional(),
  Type: z.string().optional(),
  SeriesName: z.string().nullable().optional(),
  SeasonName: z.string().nullable().optional(),
  IndexNumber: z.number().nullable().optional(),
  ParentIndexNumber: z.number().nullable().optional(),
  ProductionYear: z.number().nullable().optional(),
  RunTimeTicks: z.number().nullable().optional(),
  Album: z.string().nullable().optional(),
  Artists: z.array(z.string()).nullable().optional(),
});

export const PlayStateSchema = z.looseObject({
  PositionTicks: z.number().nullable().optional(),
  IsPaused: z.boolean().optional(),
  PlayMethod: z.enum(["Transcode", "DirectStream", "DirectPlay"]).nullable().optional(),
});

export const TranscodingInfoSchema = z.looseObject({
  AudioCodec: z.string().nullable().optional(),
  VideoCodec: z.string().nullable().optional(),
  Container: z.string().nullable().optional(),
  IsVideoDirect: z.boolean().optional(),
  IsAudioDirect: z.boolean().optional(),
  Bitrate: z.number().nullable().optional(),
  Width: z.number().nullable().optional(),
  Height: z.number().nullable().optional(),
  CompletionPercentage: z.number().nullable().optional(),
  HardwareAccelerationType: z.string().nullable().optional(),
  TranscodeReasons: z.array(z.string()).nullable().optional(),
});

export const SessionInfoSchema = z.looseObject({
  Id: z.string().nullable().optional(),
  UserId: z.string().optional(),
  UserName: z.string().nullable().optional(),
  Client: z.string().nullable().optional(),
  DeviceName: z.string().nullable().optional(),
  DeviceId: z.string().nullable().optional(),
  ApplicationVersion: z.string().nullable().optional(),
  RemoteEndPoint: z.string().nullable().optional(),
  LastActivityDate: z.string().optional(),
  LastPlaybackCheckIn: z.string().optional(),
  IsActive: z.boolean().optional(),
  SupportsMediaControl: z.boolean().optional(),
  SupportsRemoteControl: z.boolean().optional(),
  NowPlayingItem: NowPlayingItemSchema.nullable().optional(),
  PlayState: PlayStateSchema.nullable().optional(),
  TranscodingInfo: TranscodingInfoSchema.nullable().optional(),
});
export const SessionListSchema = z.array(SessionInfoSchema);

export const DeviceInfoSchema = z.looseObject({
  Id: z.string().nullable().optional(),
  Name: z.string().nullable().optional(),
  CustomName: z.string().nullable().optional(),
  AppName: z.string().nullable().optional(),
  AppVersion: z.string().nullable().optional(),
  LastUserName: z.string().nullable().optional(),
  LastUserId: z.string().nullable().optional(),
  DateLastActivity: z.string().nullable().optional(),
});
export const DeviceListSchema = z.looseObject({ Items: z.array(DeviceInfoSchema).nullable().optional() });

export const MediaFolderSchema = z.looseObject({
  Id: z.string(),
  Name: z.string().nullable().optional(),
  CollectionType: z.string().nullable().optional(),
});
export const MediaFolderListSchema = z.looseObject({ Items: z.array(MediaFolderSchema).nullable().optional() });

export const ParentalRatingSchema = z.looseObject({
  Name: z.string(),
  Value: z.number().nullable().optional(),
});
export const ParentalRatingListSchema = z.array(ParentalRatingSchema);

export type ValidatedSession = z.infer<typeof SessionInfoSchema>;
export type ValidatedDevice = z.infer<typeof DeviceInfoSchema>;
export type ValidatedMediaFolder = z.infer<typeof MediaFolderSchema>;
export type ValidatedParentalRating = z.infer<typeof ParentalRatingSchema>;
