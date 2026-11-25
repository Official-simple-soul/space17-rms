import { createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const id = Date.now().toString(36);
const password = "Correct-horse-9!";
const rootEmail = `root-${id}@test.local`;
const ownerEmail = `owner-${id}@test.local`;

function totp(secret: string) {
  const bits = [...secret]
    .map((c) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[19] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function enrol(page: Page) {
  await page.getByRole("button", { name: "Set up two-step verification" }).click();
  const secret = (await page.locator("code").textContent())!.trim();
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  return secret;
}

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: rootEmail,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const granted = await admin.rpc("grant_platform_admin", { p_user: data.user.id });
  if (granted.error) throw granted.error;
});

test("public sign-up is blocked", async () => {
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await anon.auth.signUp({ email: `x-${id}@test.local`, password });
  expect(error?.code).toBe("signup_disabled");
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/platform");
  await expect(page).toHaveURL(/sign-in\?next=%2Fplatform/);
});

test("superadmin invites an organisation and its admin sets it up", async ({ page, browser }) => {
  await signIn(page, rootEmail);
  await expect(page).toHaveURL(/mfa/);
  await enrol(page);
  await expect(page).toHaveURL(/platform/);
  await page.getByLabel("Organisation admin's email").fill(ownerEmail);
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = (await page.getByTestId("invite-link").textContent())!;

  const owner = await (await browser.newContext()).newPage();
  await owner.goto(link);
  await owner.getByLabel("Full name").fill("Ada Owner");
  await owner.getByLabel("Password", { exact: true }).fill(password);
  await owner.getByRole("button", { name: "Create account" }).click();
  await owner.getByLabel("Organisation name").fill(`Acme ${id}`);
  await owner.getByRole("button", { name: "Create organisation" }).click();
  await expect(owner.getByRole("heading", { name: "Hello, Ada" })).toBeVisible();
  const slug = `acme-${id}`;
  await expect(owner).toHaveURL(new RegExp(`/o/${slug}$`));
  await owner.screenshot({ path: "test-results/dashboard.png", fullPage: true });

  await owner.goto(`/o/${slug}/settings`);
  await owner.getByLabel("Organisation name").fill(`Acme Group ${id}`);
  await owner.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByText("Confirm two-step verification")).toBeVisible();
  await owner.goto("/account");
  const secret = await enrol(owner);
  await expect(owner.getByText("Two-step verification is on.")).toBeVisible();
  await owner.goto(`/o/${slug}/settings`);
  await owner.getByLabel("Organisation name").fill(`Acme Group ${id}`);
  await owner.getByRole("button", { name: "Save changes" }).click();
  await expect(owner.getByText("Organisation details saved.")).toBeVisible();
  await owner.goto(`/o/${slug}/audit`);
  await expect(owner.getByText("Organisation updated")).toBeVisible();
  await owner.goto(`/o/${slug}/members`);
  await expect(owner.getByText("Organisation admin")).toBeVisible();

  // Reused link, foreign pages and the MFA challenge on the next sign-in.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(link);
  await expect(stranger.getByText("already been used")).toBeVisible();
  expect((await owner.goto("/platform"))?.status()).toBe(404);
  await page.goto(`/o/${slug}`);
  await expect(page.getByText("We couldn't find that page")).toBeVisible();

  await signIn(stranger, ownerEmail);
  await expect(stranger).toHaveURL(/mfa/);
  await stranger.goto(`/o/${slug}`);
  await expect(stranger).toHaveURL(/mfa/);
  await stranger.getByLabel("6-digit code").fill(totp(secret));
  await stranger.getByRole("button", { name: "Verify" }).click();
  await expect(stranger).toHaveURL(new RegExp(`/o/${slug}$`));
  await expect(stranger.getByLabel("Switch organisation")).toHaveCount(0);

  await page.goto("/platform");
  const row = page.locator("li").filter({ hasText: `/${slug}` });
  await row.getByText("Manage access").click();
  await row.getByLabel("Reason").fill("Testing suspension");
  page.on("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Suspend" }).click();
  await expect(row.getByRole("button", { name: "Reactivate" })).toBeVisible();
  await page.screenshot({ path: "test-results/platform.png", fullPage: true });
  await owner.goto(`/o/${slug}`);
  await expect(owner.getByRole("heading", { name: /is suspended/ })).toBeVisible();
});

test("password reset changes the password", async ({ page, request }) => {
  const email = `reset-${id}@test.local`;
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("a reset link is on its way")).toBeVisible();
  let body = "";
  await expect
    .poll(async () => {
      const list = await (
        await request.get(
          `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        )
      ).json();
      if (!list.messages?.length) return false;
      body = (
        await (
          await request.get(`http://127.0.0.1:54324/api/v1/message/${list.messages[0].ID}`)
        ).json()
      ).Text;
      return true;
    })
    .toBe(true);
  await page.goto(body.match(/https?:\/\/[^\s)]+/)![0]);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("New password").fill("Another-horse-10!");
  await page.getByLabel("Confirm password").fill("Another-horse-10!");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL(/no-organisation/);
});

test("access request and mobile layout", async ({ page }) => {
  await page.goto("/sign-in");
  await page.screenshot({ path: "test-results/sign-in.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/request-access");
  await page.screenshot({ path: "test-results/mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Organisation name").fill("Test Org");
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByLabel("Work email").fill(`ask-${id}@test.local`);
  await page.getByRole("button", { name: "Request access" }).click();
  await expect(page.getByText("Thanks.")).toBeVisible();
});

test("sign out asks for confirmation", async ({ page }) => {
  const email = `out-${id}@test.local`;
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await signIn(page, email);
  await expect(page).toHaveURL(/no-organisation/);
  await page.getByRole("button", { name: "Sign out" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: "test-results/sign-out.png" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/no-organisation/);
  await page.goto("/mfa");
  await page.screenshot({ path: "test-results/mfa.png" });
  await page.getByRole("button", { name: "Sign out" }).click();
  await dialog.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/sign-in/);
  await page.goto("/account");
  await expect(page).toHaveURL(/sign-in/);
});

test("someone in two organisations can switch and returns to the last one", async ({ page }) => {
  const email = `two-${id}@test.local`;
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const user = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await user.auth.signInWithPassword({ email, password });
  const root = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const rootUser = `inviter-${id}@test.local`;
  const made = await admin.auth.admin.createUser({
    email: rootUser,
    password,
    email_confirm: true,
  });
  await admin.rpc("grant_platform_admin", { p_user: made.data.user!.id });
  await root.auth.signInWithPassword({ email: rootUser, password });
  const factor = await root.auth.mfa.enroll({ factorType: "totp" });
  if (factor.error) throw factor.error;
  await root.auth.mfa.challengeAndVerify({
    factorId: factor.data.id,
    code: totp(factor.data.totp.secret),
  });
  for (const name of ["alpha", "beta"]) {
    const invite = await root.rpc("create_org_invite", { p_email: email });
    const accepted = await user.rpc("accept_org_invite", {
      p_token: invite.data,
      p_name: `${name} ${id}`,
      p_slug: `${name}-${id}`,
    });
    if (accepted.error) throw accepted.error;
  }
  expect(data.user).toBeTruthy();
  await signIn(page, email);
  await expect(page).toHaveURL(new RegExp(`/o/alpha-${id}$`));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("select:visible").selectOption(`beta-${id}`);
  await expect(page).toHaveURL(new RegExp(`/o/beta-${id}$`));
  await page.screenshot({ path: "test-results/mobile-org.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/o/beta-${id}$`));
});
