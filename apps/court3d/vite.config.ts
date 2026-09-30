import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Живой предпросмотр: 0.0.0.0 и любой хост прокси-окружения.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5199,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 5199,
    allowedHosts: true,
  },
});
