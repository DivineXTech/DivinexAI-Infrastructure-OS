import path from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: [
      // The "server-only" marker package throws unless resolved through
      // Next's "react-server" export condition. Vitest runs plain Node, so
      // point it at the package's own no-op "empty.js" instead — the same
      // file Next resolves to when the condition *is* present.
      {
        find: "server-only",
        replacement: path.resolve(rootDir, "node_modules/server-only/empty.js"),
      },
      { find: "@", replacement: rootDir },
    ],
  },
});
