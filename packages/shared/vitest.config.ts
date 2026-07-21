import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Tenant-isolation tests share one Postgres test database and reset it
    // in beforeAll; running files in parallel would race that reset.
    fileParallelism: false,
  },
});
