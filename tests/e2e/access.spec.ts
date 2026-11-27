import { networkInterfaces } from "node:os";
import { expect, test } from "@playwright/test";
import { admin, createOrganisation, enrol, password, signIn } from "./helpers";

// A real 8x8 photo, so the preview can be checked.
const photo = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGNYJCWFFTEMLQkAqqQuAaHrlLoAAAAASUVORK5CYII=",
  "base64",
);

test("people only reach what their role allows, and photos work from a phone", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const id = `a${Date.now().toString(36)}`;
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);
  const org = (await admin.from("organisations").select("id").eq("slug", `acme-${id}`).single())
    .data!.id as string;
  await signIn(page, owner);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto("/account");
  await enrol(page);
  await expect(page.getByText("Two-step verification is on.").first()).toBeVisible();
  await page.goto(`${base}/configuration`);
  await page.getByRole("button", { name: "Add these" }).click();
  await expect(page.getByRole("row", { name: /Supplies/ })).toBeVisible();

  const insert = async (table: string, row: object) => {
    const { data, error } = await admin.from(table).insert(row).select().single();
    if (error) throw error;
    return data.id as string;
  };
  const email = `req-${id}@test.local`;
  const user = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Rita" },
  });
  const member = await insert("memberships", { org_id: org, user_id: user.data.user!.id });
  const role = await insert("roles", { org_id: org, name: "Requester" });
  const permission = { org_id: org, role_id: role, permission_key: "requests.create" };
  await admin.from("role_permissions").insert({ ...permission, scope: "own" });
  await admin
    .from("membership_roles")
    .insert({ org_id: org, membership_id: member, role_id: role });
  const dept = await insert("departments", { org_id: org, name: "Field", code: "FLD" });
  await insert("departments", { org_id: org, name: "Hidden department", code: "HID" });
  await admin
    .from("department_members")
    .insert({ org_id: org, department_id: dept, membership_id: member });

  // Over the network address, as a phone would. It is plain http, so some browser features are off.
  const address = Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .find((a) => a.family === "IPv4" && !a.internal)?.address;
  const context = await browser.newContext({
    baseURL: address ? baseURL!.replace("127.0.0.1", address) : baseURL,
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const phone = await context.newPage();
  await signIn(phone, email);
  await expect(phone.getByRole("heading", { name: "Hello, Rita" })).toBeVisible();
  if (address) expect(await phone.evaluate(() => isSecureContext)).toBe(false);

  const closed = "members departments roles configuration configuration/categories settings audit";
  for (const path of `${closed} payments reports approvals expenses expenses/new`.split(" ")) {
    await phone.goto(`${base}/${path}`);
    await expect(phone.getByText("We couldn't find that page"), path).toBeVisible();
  }
  expect((await phone.goto("/platform"))?.status()).toBe(404);
  await phone.goto(base);
  await phone.setViewportSize({ width: 1280, height: 800 });
  const menu = phone.getByRole("navigation").first();
  await expect(menu.getByRole("listitem")).toHaveText(["Dashboard", "Requests", "Notifications"]);
  await phone.screenshot({ animations: "disabled", path: "test-results/limited-menu.png" });
  await phone.setViewportSize({ width: 390, height: 844 });

  await phone.goto(`${base}/requests/new`);
  await phone.getByLabel("What do you need?").fill("New pot");
  await expect(phone).toHaveURL(/new\?draft=/);
  await expect(phone.getByText("Hidden department")).toHaveCount(0);
  const upload = { name: "image.png", mimeType: "image/png", buffer: photo };
  await phone.locator('input[capture="environment"]').first().setInputFiles(upload);
  await expect(phone.getByRole("button", { name: "Remove image.png" })).toBeVisible();
  const shown = () =>
    phone
      .locator("main li img")
      .first()
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  await expect.poll(shown).toBe(true);
  await phone.reload();
  await expect(phone.getByRole("button", { name: "Remove image.png" })).toBeVisible();
  await expect.poll(shown).toBe(true);
  await phone.screenshot({
    animations: "disabled",
    path: "test-results/m-photo.png",
    fullPage: true,
  });
});
