import { describe, expect, it } from "vitest";
import { createDb, poolMaxFromEnv } from "../src/db/index.js";

describe("размер пула PostgreSQL", () => {
  it("оставляет минимум два соединения для advisory lock и самого мигратора", () => {
    expect(poolMaxFromEnv({ ...process.env, PG_POOL_MAX: "1" })).toBe(2);
    expect(poolMaxFromEnv({ ...process.env, PG_POOL_MAX: "2" })).toBe(2);
    expect(poolMaxFromEnv({ ...process.env, PG_POOL_MAX: "80" })).toBe(50);
    expect(poolMaxFromEnv({ ...process.env, PG_POOL_MAX: "invalid" })).toBe(10);
    expect(() => createDb("postgres://localhost/unused", { max: 1 })).toThrow(RangeError);
  });
});
