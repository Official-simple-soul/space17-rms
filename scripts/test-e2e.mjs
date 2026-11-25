// Runs browser tests against a separate, disposable Supabase stack so local data is never touched.
// Usage: pnpm test:e2e [playwright arguments]      Stop the stack with: pnpm test:e2e:stop
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const dir = ".test-stack";
const run = (args, options = {}) =>
  execFileSync("pnpm", ["-s", "supabase", ...args, "--workdir", dir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });

if (process.argv[2] === "--stop") {
  run(["stop", "--no-backup"]);
  process.exit(0);
}

rmSync(`${dir}/supabase`, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
cpSync("supabase", `${dir}/supabase`, {
  recursive: true,
  filter: (path) => !path.includes(".temp") && !path.includes(".branches"),
});
const config = `${dir}/supabase/config.jsonc`;
writeFileSync(
  config,
  readFileSync(config, "utf8")
    .replace('"project_id": "space17-rms"', '"project_id": "space17-rms-test"')
    .replace(/\b543(2\d)\b/g, "553$1")
    .replace('"inspector_port": 8083', '"inspector_port": 8093')
    .replaceAll(":3100", ":3210"),
);

const excluded = "studio,realtime,edge-runtime,logflare,vector,postgres-meta,imgproxy";
run(["start", "-x", excluded]);
run(["db", "reset", "--local"]);
const raw = run(["status", "-o", "json"]);
const status = JSON.parse(raw.slice(raw.indexOf("{")));
if (new URL(status.API_URL).port !== "55321") throw new Error("Refusing to test: wrong stack.");

const { status: code } = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_STACK: "1",
      CRON_SECRET: "test-cron-secret",
      RESEND_API_KEY: "",
      NEXT_DIST_DIR: ".next-test",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3210",
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
      SUPABASE_SECRET_KEY: status.SECRET_KEY,
      MAILPIT_URL: status.MAILPIT_URL ?? "http://127.0.0.1:55324",
    },
  },
);
process.exit(code ?? 1);
