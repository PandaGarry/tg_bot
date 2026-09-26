import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/globalSetup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 90_000,
    // Миры разделены по world_id, но база одна: файлы идут по очереди.
    pool: "forks",
    fileParallelism: false,
  },
});
