CREATE TABLE `audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_user_id` text,
	`before` text,
	`after` text,
	`detail` text,
	`request_id` text
);
--> statement-breakpoint
CREATE INDEX `audit_ts_idx` ON `audit` (`ts`);--> statement-breakpoint
CREATE INDEX `audit_target_idx` ON `audit` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `audit_action_idx` ON `audit` (`action`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit` (`actor_type`,`actor_id`);--> statement-breakpoint
CREATE TABLE `invite` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`label` text,
	`profile_id` text,
	`expires_at` integer,
	`max_uses` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	`account_expiry_days` integer,
	`require_email` integer DEFAULT false NOT NULL,
	`note_for_invitee` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_hash_idx` ON `invite` (`token_hash`);--> statement-breakpoint
CREATE TABLE `invite_use` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`jellyfin_user_id` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invite_id`) REFERENCES `invite`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invite_use_invite_idx` ON `invite_use` (`invite_id`);--> statement-breakpoint
CREATE TABLE `job_run` (
	`name` text PRIMARY KEY NOT NULL,
	`lock_until` integer,
	`last_started_at` integer,
	`last_finished_at` integer,
	`last_result` text
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`policy` text NOT NULL,
	`default_expiry_days` integer,
	`inactivity_disable_days` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_name_unique` ON `profile` (`name`);--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `token` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`jellyfin_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`email` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_hash_idx` ON `token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `token_user_idx` ON `token` (`jellyfin_user_id`);--> statement-breakpoint
CREATE TABLE `user_meta` (
	`jellyfin_user_id` text PRIMARY KEY NOT NULL,
	`email` text,
	`email_verified_at` integer,
	`notes` text,
	`labels` text DEFAULT '[]' NOT NULL,
	`profile_id` text,
	`expires_at` integer,
	`inactivity_disable_days` integer,
	`disabled_by_app_at` integer,
	`disabled_reason` text,
	`delete_after` integer,
	`created_via_invite_id` text,
	`first_seen_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `user_meta_profile_idx` ON `user_meta` (`profile_id`);--> statement-breakpoint
CREATE INDEX `user_meta_email_idx` ON `user_meta` (`email`);