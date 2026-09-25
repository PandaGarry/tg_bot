ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "email_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "accept_mail" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Почта одна на аккаунт; пустые строки старых аккаунтов не мешают: индекс частичный.
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_email_key_idx" ON "accounts" USING btree ("email_key") WHERE "email_key" <> '';
