import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/server.ts", "src/app/api/**/*.ts"],
      reporter: ["text", "html", "lcov", "json-summary"],
      thresholds: { lines: 95, functions: 95, branches: 85, statements: 95 },
    },
  },
});
