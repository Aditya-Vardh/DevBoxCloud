ALTER TABLE `environment_templates` MODIFY COLUMN `runtime` enum('node','python','go','ubuntu','java','nodejs','react','fullstack') NOT NULL;--> statement-breakpoint
ALTER TABLE `environments` MODIFY COLUMN `runtime` enum('node','python','go','ubuntu','java','nodejs','react','fullstack') NOT NULL;--> statement-breakpoint
ALTER TABLE `environments` ADD `desktopUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `environments` ADD `terminalUrl` varchar(2048);