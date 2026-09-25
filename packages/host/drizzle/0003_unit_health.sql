-- Здоровье единиц: следы сбоев, карантин и лечение с отступом.
CREATE TABLE IF NOT EXISTS "unit_health" (
  "world_id" text NOT NULL,
  "scope_key" text NOT NULL,
  "module_id" text NOT NULL,
  "unit_id" text,
  "failures" integer DEFAULT 0 NOT NULL,
  "until_ms" bigint DEFAULT 0 NOT NULL,
  "needs_operator" boolean DEFAULT false NOT NULL,
  "last_error" text,
  "updated_at_ms" bigint NOT NULL,
  CONSTRAINT "unit_health_world_id_scope_key_pk" PRIMARY KEY ("world_id","scope_key")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_health_module_idx" ON "unit_health" ("world_id","module_id");
ALTER TABLE "deadlines" ADD COLUMN IF NOT EXISTS "unit_id" text;--> statement-breakpoint
