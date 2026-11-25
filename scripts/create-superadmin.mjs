// Usage: pnpm create-superadmin   (prompts locally; nothing is stored in files)
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Supabase environment values are missing.");

let muted = false;
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!muted) process.stdout.write(chunk);
    done();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });
console.log(`Target: ${new URL(url).host}`);
const email = process.env.SUPERADMIN_EMAIL ?? (await rl.question("Email: "));
let password = process.env.SUPERADMIN_PASSWORD;
if (!password) {
  process.stdout.write("Password (10+ characters, hidden): ");
  muted = true;
  password = await rl.question("");
  muted = false;
  process.stdout.write("\n");
}
rl.close();
if (password.length < 10) throw new Error("Use at least 10 characters.");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.admin.createUser({
  email: email.trim().toLowerCase(),
  password,
  email_confirm: true,
  user_metadata: { full_name: "Platform admin" },
});
if (error) throw new Error(error.message);
const granted = await supabase.rpc("grant_platform_admin", { p_user: data.user.id });
if (granted.error) throw new Error(granted.error.message);
console.log("Superadmin created. Sign in and set up two-step verification.");
