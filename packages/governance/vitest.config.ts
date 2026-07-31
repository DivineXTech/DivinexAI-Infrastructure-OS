import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Multiple DB-backed test files share one Postgres test database and
    // reset it in beforeAll; running files in parallel would race that
    // reset (same reasoning as packages/shared and packages/workflow-engine).
    fileParallelism: false,
  },
});
