/**
 * Production entry point. Set NODE_ENV before the server imports configuration
 * and before .env is loaded; development remains available through pnpm dev.
 */
if (process.env.NODE_ENV && process.env.NODE_ENV !== "production") {
  throw new Error("Production start refused: NODE_ENV must be production");
}
process.env.NODE_ENV = "production";
await import("../apps/server/dist/index.mjs");
