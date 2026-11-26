import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const password = "Correct-horse-9!";
export const newClient = (key = publishableKey) =>
  createClient(url, key, { auth: { persistSession: false } });
export const admin = newClient(process.env.SUPABASE_SECRET_KEY!);

export function totp(secret: string) {
  const bits = [...secret]
    .map((c) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  return String((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function enrol(page: Page) {
  await page.getByRole("button", { name: "Set up two-step verification" }).click();
  const secret = (await page.locator("code").textContent())!.trim();
  await page.getByLabel("6-digit code").fill(totp(secret));
  // The code sends itself once all six digits are in.
  return secret;
}

/** Creates an organisation through the same database functions the app uses. */
export async function createOrganisation(id: string, ownerEmail: string) {
  const rootEmail = `inviter-${id}@test.local`;
  const root = await admin.auth.admin.createUser({
    email: rootEmail,
    password,
    email_confirm: true,
  });
  if (root.error) throw root.error;
  await admin.rpc("grant_platform_admin", { p_user: root.data.user.id });
  const rootClient = newClient();
  await rootClient.auth.signInWithPassword({ email: rootEmail, password });
  const factor = await rootClient.auth.mfa.enroll({ factorType: "totp" });
  if (factor.error) throw factor.error;
  await rootClient.auth.mfa.challengeAndVerify({
    factorId: factor.data.id,
    code: totp(factor.data.totp.secret),
  });
  const invite = await rootClient.rpc("create_org_invite", { p_email: ownerEmail });
  await admin.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Ada Owner" },
  });
  const owner = newClient();
  await owner.auth.signInWithPassword({ email: ownerEmail, password });
  const accepted = await owner.rpc("accept_org_invite", {
    p_token: invite.data,
    p_name: `Acme ${id}`,
    p_slug: `acme-${id}`,
  });
  if (accepted.error) throw accepted.error;
  return `/o/acme-${id}`;
}

/** Answers the confirmation dialog. */
export async function confirm(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button").last().click();
  await expect(dialog).toHaveCount(0);
}
