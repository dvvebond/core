import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/checkouts/**"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test-utils.ts"],
      reporter: ["text", "html"],
    },
    benchmark: {
      include: ["benchmarks/**/*.bench.ts"],
      exclude: ["**/node_modules/**", "**/checkouts/**"],
    },
  },
});
