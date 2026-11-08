DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM lords
    GROUP BY world_id, account_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'cannot add lords_account_world_idx: duplicate account/world lords require manual review';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "lords_account_world_idx"
  ON "lords" USING btree ("world_id", "account_id");
--> statement-breakpoint
ALTER TABLE "commands" DROP CONSTRAINT "commands_world_id_idempotency_key_pk";
--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_world_id_actor_idempotency_key_pk"
  PRIMARY KEY ("world_id", "actor_id", "idempotency_key");
