import { defineConfig, devices } from "@playwright/test";

// Tests create users, so they may only target the local stack.
process.loadEnvFile(".env.local");
const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
if (!["127.0.0.1", "localhost"].includes(host))
  throw new Error("E2E tests require local Supabase.");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://127.0.0.1:3100/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
