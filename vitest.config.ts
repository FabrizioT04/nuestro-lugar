import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Pruebas unitarias de lógica pura (sin el runtime de Cloudflare).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    include: ["worker/**/*.test.ts", "shared/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
