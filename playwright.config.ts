import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium" },
  webServer: [
    {
      command: "node tests/e2e/server.mjs",
      url: "http://127.0.0.1:31337/api/tasks",
      reuseExistingServer: false,
    },
    {
      command: "API_PORT=31337 npm run dev -- --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
  ],
});
