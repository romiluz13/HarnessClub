import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

// Load .env.test for real MongoDB connection
dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    testTimeout: 150000,
    hookTimeout: 60000,
    fileParallelism: false,
    // Default environment is node for integration tests.
    // Component tests opt-in to jsdom via @vitest-environment jsdom comment.
    environment: "node",
    setupFiles: [],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/app/**/*.tsx"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
