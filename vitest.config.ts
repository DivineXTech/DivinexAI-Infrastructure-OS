import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js resolves "server-only" to its no-op build via the
      // "react-server" package export condition, which Vitest doesn't set
      // by default (and setting it globally would also repoint react/
      // react-dom at their RSC builds, breaking component tests). Alias
      // just this one package directly instead.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
