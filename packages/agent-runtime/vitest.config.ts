import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // DB-backed test files share one Postgres test database and each resets
    // it in beforeAll (see packages/shared/vitest.config.ts for the same
    // reasoning) — running files in parallel races that reset.
    fileParallelism: false,
  },
});
