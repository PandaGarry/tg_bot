CREATE TABLE "accounts" (
	"account_id" text PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"login_key" text NOT NULL,
	"password_hash" text NOT NULL,
	"lang" text DEFAULT 'ru' NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" text NOT NULL,
	"actor_id" text,
	"module_id" text,
	"request_id" text,
	"command_id" text,
	"entity" text,
	"outcome" text NOT NULL,
	"idempotency_key" text,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"world_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"module_id" text NOT NULL,
	"command_id" text NOT NULL,
	"outcome" text NOT NULL,
	"error_key" text,
	"at_ms" bigint NOT NULL,
	CONSTRAINT "commands_world_id_idempotency_key_pk" PRIMARY KEY("world_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "deadlines" (
	"world_id" text NOT NULL,
	"id" text NOT NULL,
	"owner" text NOT NULL,
	"wake_at_ms" bigint NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb,
	"created_at_ms" bigint NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "deadlines_world_id_id_pk" PRIMARY KEY("world_id","id")
);
--> statement-breakpoint
CREATE TABLE "gathers" (
	"world_id" text NOT NULL,
	"gather_id" text NOT NULL,
	"module_id" text NOT NULL,
	"holder_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"speed_per_hour" double precision NOT NULL,
	"started_at_ms" bigint NOT NULL,
	"stock_left" bigint NOT NULL,
	"capacity" bigint NOT NULL,
	CONSTRAINT "gathers_world_id_gather_id_pk" PRIMARY KEY("world_id","gather_id")
);
--> statement-breakpoint
CREATE TABLE "lords" (
	"lord_id" text PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"portrait" text NOT NULL,
	"banner_sign" text NOT NULL,
	"banner_color" text NOT NULL,
	"lord_type" text NOT NULL,
	"clan_id" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_states" (
	"world_id" text NOT NULL,
	"module_id" text NOT NULL,
	"state" text DEFAULT 'enabled' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "module_states_world_id_module_id_pk" PRIMARY KEY("world_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"world_id" text NOT NULL,
	"lord_id" text NOT NULL,
	"kind" text NOT NULL,
	"at_ms" bigint NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"world_id" text NOT NULL,
	"lord_id" text,
	"protocol_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sim_rejections" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"world_id" text NOT NULL,
	"actor_id" text,
	"module_id" text,
	"deadline_id" text,
	"request_id" text,
	"reason" text NOT NULL,
	"claimed" jsonb,
	"computed" jsonb,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"world_id" text NOT NULL,
	"holder_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "stock_world_id_holder_id_resource_id_pk" PRIMARY KEY("world_id","holder_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "world_pulse" (
	"world_id" text PRIMARY KEY NOT NULL,
	"real_at_ms" bigint NOT NULL,
	"world_at_ms" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"world_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"seed" bigint NOT NULL,
	"size" integer NOT NULL,
	"zones" integer DEFAULT 5 NOT NULL,
	"zone_pit" integer DEFAULT 4 NOT NULL,
	"zone_capital" integer DEFAULT 5 NOT NULL,
	"clock_offset_ms" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "writer_leases" (
	"world_id" text PRIMARY KEY NOT NULL,
	"epoch" bigint NOT NULL,
	"holder" text NOT NULL,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_login_key_idx" ON "accounts" USING btree ("login_key");--> statement-breakpoint
CREATE INDEX "audit_world_idx" ON "audit_log" USING btree ("world_id","id");--> statement-breakpoint
CREATE INDEX "deadlines_due_idx" ON "deadlines" USING btree ("world_id","wake_at_ms");--> statement-breakpoint
CREATE UNIQUE INDEX "deadlines_key_idx" ON "deadlines" USING btree ("world_id","key");--> statement-breakpoint
CREATE INDEX "gathers_world_idx" ON "gathers" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lords_name_idx" ON "lords" USING btree ("world_id","name_key");--> statement-breakpoint
CREATE INDEX "lords_account_idx" ON "lords" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "reports_lord_idx" ON "reports" USING btree ("world_id","lord_id","id");--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sim_world_idx" ON "sim_rejections" USING btree ("world_id","id");