CREATE TABLE `canonical_parts` (
	`part_id` text PRIMARY KEY NOT NULL,
	`schema_version` text NOT NULL,
	`category` text NOT NULL,
	`manufacturer` text NOT NULL,
	`model` text NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `external_mappings` (
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`part_id` text NOT NULL,
	`raw_name` text NOT NULL,
	`match_method` text NOT NULL,
	`confidence` text NOT NULL,
	`status` text NOT NULL,
	`matched_at` text NOT NULL,
	`mapper_version` text NOT NULL,
	PRIMARY KEY(`source`, `external_id`),
	FOREIGN KEY (`part_id`) REFERENCES `canonical_parts`(`part_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `raw_evidence` (
	`evidence_id` text PRIMARY KEY NOT NULL,
	`field_path` text NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `field_evidence` (
	`evidence_id` text PRIMARY KEY NOT NULL,
	`issue_type` text NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `result_snapshots` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`canonical_schema_version` text NOT NULL,
	`payload_json` text NOT NULL
);
