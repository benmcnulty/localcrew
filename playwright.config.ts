import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/playwright",
  use: {
    baseURL: "http://127.0.0.1:4310",
  },
  webServer: {
    command: "bun run src/index.ts",
    url: "http://127.0.0.1:4310/api/health",
    reuseExistingServer: true,
    timeout: 15000,
  },
});
