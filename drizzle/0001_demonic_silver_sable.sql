CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(96) NOT NULL,
	`resourceType` varchar(64) NOT NULL,
	`resourceId` varchar(96),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `environment_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`environmentId` int NOT NULL,
	`eventType` enum('created','started','stopped','restarted','deleted','error','status_changed') NOT NULL,
	`status` enum('provisioning','running','stopped','deleted','failed') NOT NULL,
	`message` varchar(1024) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `environment_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `environment_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(96) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`runtime` enum('node','python','go','ubuntu','java') NOT NULL,
	`image` varchar(255) NOT NULL,
	`defaultCpu` varchar(24) NOT NULL,
	`maxCpu` varchar(24) NOT NULL,
	`defaultMemory` varchar(24) NOT NULL,
	`maxMemory` varchar(24) NOT NULL,
	`defaultStorage` varchar(24) NOT NULL,
	`maxStorage` varchar(24) NOT NULL,
	`allowedPorts` json NOT NULL,
	`configurationSchema` json NOT NULL,
	`active` enum('true','false') NOT NULL DEFAULT 'true',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `environment_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `environment_templates_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `environments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` varchar(512),
	`templateId` int NOT NULL,
	`status` enum('provisioning','running','stopped','deleted','failed') NOT NULL DEFAULT 'provisioning',
	`runtime` enum('node','python','go','ubuntu','java') NOT NULL,
	`cpuLimit` varchar(24) NOT NULL,
	`memoryLimit` varchar(24) NOT NULL,
	`storageLimit` varchar(24) NOT NULL,
	`port` int NOT NULL,
	`repositoryUrl` varchar(2048),
	`branch` varchar(255),
	`namespace` varchar(63) NOT NULL,
	`deploymentName` varchar(63) NOT NULL,
	`serviceName` varchar(63) NOT NULL,
	`persistentVolumeClaimName` varchar(63) NOT NULL,
	`accessUrl` varchar(2048),
	`failureReason` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`startedAt` timestamp,
	`stoppedAt` timestamp,
	`deletedAt` timestamp,
	CONSTRAINT `environments_id` PRIMARY KEY(`id`),
	CONSTRAINT `environments_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `environment_events` ADD CONSTRAINT `environment_events_environmentId_environments_id_fk` FOREIGN KEY (`environmentId`) REFERENCES `environments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `environments` ADD CONSTRAINT `environments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `environments` ADD CONSTRAINT `environments_templateId_environment_templates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `environment_templates`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_user_created_idx` ON `audit_logs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_created_idx` ON `audit_logs` (`resourceType`,`resourceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `environment_events_environment_created_idx` ON `environment_events` (`environmentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `environments_user_status_idx` ON `environments` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `environments_template_idx` ON `environments` (`templateId`);