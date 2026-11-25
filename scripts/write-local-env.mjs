// Usage: pnpm -s supabase status -o json | node scripts/write-local-env.mjs
import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync(0, "utf8");
const status = JSON.parse(raw.slice(raw.indexOf("{")));
writeFileSync(
  ".env.local",
  [
    "NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100",
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${status.SECRET_KEY}`,
    `MAILPIT_URL=${status.MAILPIT_URL ?? "http://127.0.0.1:54324"}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);
console.log("Wrote .env.local for the local stack.");
