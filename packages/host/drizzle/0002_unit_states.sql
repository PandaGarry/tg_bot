-- Переключатели со сроком: оператор гасит модуль или единицу до времени и с причиной.
ALTER TABLE "module_states" ADD COLUMN IF NOT EXISTS "until_ms" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "module_states" ADD COLUMN IF NOT EXISTS "reason" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unit_states" (
  "world_id" text NOT NULL,
  "module_id" text NOT NULL,
  "unit_id" text NOT NULL,
  "state" text DEFAULT 'enabled' NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "until_ms" bigint DEFAULT 0 NOT NULL,
  "reason" text,
  CONSTRAINT "unit_states_world_id_module_id_unit_id_pk" PRIMARY KEY ("world_id","module_id","unit_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unit_states_world_idx" ON "unit_states" ("world_id");
