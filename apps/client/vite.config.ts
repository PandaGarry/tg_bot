// defineConfig из vitest/config: поле test типизировано, сборка остаётся vite.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    host: "0.0.0.0",
    // Клиент живёт в том же процессе, что мир: отдельного адреса у него нет.
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  // Тесты оболочки идут в jsdom: разметка и порядок экранов проверяются без браузера.
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.tsx"],
  },
});
