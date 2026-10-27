CREATE TABLE `invitation_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invitationId` int NOT NULL,
	`userId` int NOT NULL,
	`redeemedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitation_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitation_redemptions_unique` UNIQUE(`invitationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`environmentId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`maxUses` int,
	`useCount` int NOT NULL DEFAULT 0,
	`revoked` enum('true','false') NOT NULL DEFAULT 'false',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `invitation_redemptions` ADD CONSTRAINT `invitation_redemptions_invitationId_invitations_id_fk` FOREIGN KEY (`invitationId`) REFERENCES `invitations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitation_redemptions` ADD CONSTRAINT `invitation_redemptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_environmentId_environments_id_fk` FOREIGN KEY (`environmentId`) REFERENCES `environments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `invitations_env_idx` ON `invitations` (`environmentId`);--> statement-breakpoint
CREATE INDEX `invitations_owner_idx` ON `invitations` (`ownerUserId`);