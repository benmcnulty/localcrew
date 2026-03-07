import { defineConfig } from "@playwright/test";

const configuredBaseUrl = process.env.LOCALCREW_PLAYWRIGHT_BASE_URL?.trim();
const playwrightPort = Number(
  process.env.LOCALCREW_PLAYWRIGHT_PORT ??
    process.env.LOCALCREW_API_PORT ??
    "4311"
);
const baseURL = configuredBaseUrl || `http://127.0.0.1:${playwrightPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL,
  },
  webServer: configuredBaseUrl
    ? undefined
    : {
        command: "bun run src/index.ts",
        env: {
          ...process.env,
          LOCALCREW_API_PORT: String(playwrightPort)
        },
        url: `${baseURL}/api/health`,
        reuseExistingServer: false,
        timeout: 15000,
      },
});
