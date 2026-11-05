import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results/stack",
  testMatch: ["api.spec.ts", "login.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 30000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { Origin: "http://localhost:3000" },
  },
});
