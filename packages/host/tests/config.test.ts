import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

function productionEnv(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: "postgres://tdl:tdl@127.0.0.1:5432/tdl",
    PORT: "3000",
    SESSION_SECRET: randomBytes(48).toString("base64url"),
    ADMIN_TOKEN: randomBytes(48).toString("base64url"),
    REGISTRATION_OPEN: "0",
    WORLD_ID: "tdl-production-1",
    NODE_ENV: "production",
    ACCESS_MODE: "public",
  };
}

describe("production configuration", () => {
  it("accepts explicit strong secrets and explicit world policy", () => {
    const config = loadConfig(productionEnv());
    expect(config.isProduction).toBe(true);
    expect(config.registrationOpen).toBe(false);
    expect(config.accessPublic).toBe(true);
  });

  it("rejects weak or reused secrets", () => {
    const weak = productionEnv();
    weak.SESSION_SECRET = "x".repeat(16);
    expect(() => loadConfig(weak)).toThrow(/SESSION_SECRET/);
    const reused = productionEnv();
    reused.ADMIN_TOKEN = reused.SESSION_SECRET;
    expect(() => loadConfig(reused)).toThrow(/must differ/);
  });

  it("requires explicit world and access policy", () => {
    const missingWorld = productionEnv();
    delete missingWorld.WORLD_ID;
    expect(() => loadConfig(missingWorld)).toThrow(/WORLD_ID/);
    const missingAccess = productionEnv();
    delete missingAccess.ACCESS_MODE;
    expect(() => loadConfig(missingAccess)).toThrow(/ACCESS_MODE/);
    const missingRegistration = productionEnv();
    delete missingRegistration.REGISTRATION_OPEN;
    expect(() => loadConfig(missingRegistration)).toThrow(/REGISTRATION_OPEN/);
  });

  it("requires a strong operator token and allowlist for private worlds", () => {
    const weakAdmin = productionEnv();
    weakAdmin.ADMIN_TOKEN = "a".repeat(32);
    expect(() => loadConfig(weakAdmin)).toThrow(/ADMIN_TOKEN/);
    const privateWorld = productionEnv();
    privateWorld.ACCESS_MODE = "admins";
    privateWorld.ADMIN_LOGINS = "";
    expect(() => loadConfig(privateWorld)).toThrow(/ADMIN_LOGINS/);
  });

  it("rejects non-PostgreSQL URLs and ephemeral production ports", () => {
    const wrongDatabase = productionEnv();
    wrongDatabase.DATABASE_URL = "mysql://localhost/tdl";
    expect(() => loadConfig(wrongDatabase)).toThrow(/PostgreSQL/);
    const ephemeralPort = productionEnv();
    ephemeralPort.PORT = "0";
    expect(() => loadConfig(ephemeralPort)).toThrow(/PORT/);
  });
});
