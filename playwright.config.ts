import { defineConfig, devices } from "@playwright/test";

if (!process.env.E2E_STACK) throw new Error("Run browser tests with: pnpm test:e2e");
const baseURL = process.env.NEXT_PUBLIC_APP_URL!;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  use: { baseURL, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: {
    command: "pnpm build && pnpm exec next start -p 3210",
    url: `${baseURL}/sign-in`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
