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
