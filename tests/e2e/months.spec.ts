import { expect, test } from "@playwright/test";
import { admin, confirm, createOrganisation, enrol, password, signIn } from "./helpers";

test("finance excuses a quiet department, closes the month and can reopen it", async ({ page }) => {
  test.setTimeout(120_000);
  const id = `m${Date.now().toString(36)}`;
  const base = await createOrganisation(id, `boss-${id}@test.local`);
  const org = (await admin.from("organisations").select("id").eq("slug", `acme-${id}`).single())
    .data!.id as string;
  await admin
    .from("departments")
    .insert({ org_id: org, name: "Kitchen", code: "KIT", created_at: "2020-01-01T00:00:00Z" });
  const email = `femi-${id}@test.local`;
  const user = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Femi" },
  });
  const member = await admin
    .from("memberships")
    .insert({ org_id: org, user_id: user.data.user!.id })
    .select("id")
    .single();
  const role = await admin
    .from("roles")
    .select("id")
    .eq("org_id", org)
    .eq("system_key", "finance")
    .single();
  await admin
    .from("membership_roles")
    .insert({ org_id: org, membership_id: member.data!.id, role_id: role.data!.id });

  await signIn(page, email);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto("/account");
  await enrol(page);
  await expect(page.getByText("Two-step verification is on.").first()).toBeVisible();

  await page.goto(`${base}/reports`);
  await page.getByRole("link", { name: "Close a month" }).click();
  await expect(page.getByRole("heading", { name: "Close a month" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Kitchen/ })).toContainText("Not started");
  await page.getByRole("button", { name: /^Close [A-Z][a-z]+ [0-9]{4}$/ }).click();
  await confirm(page);
  await expect(page.getByText("Some departments aren't settled").first()).toBeVisible();

  await page.getByRole("button", { name: "Excuse Kitchen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excuse department" }).click();
  await expect(page.getByText("Department excused for this month.").first()).toBeVisible();
  await expect(page.getByRole("row", { name: /Kitchen/ })).toContainText("Excused");
  await expect(page.getByText("Every department is settled.").first()).toBeVisible();
  await page.getByRole("button", { name: /^Close [A-Z][a-z]+ [0-9]{4}$/ }).click();
  await confirm(page);
  await expect(page.getByText("Month closed.").first()).toBeVisible();
  await expect(page.getByText(/Closed by Femi/).first()).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/month-closed.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Reopen month" }).click();
  await page.getByRole("dialog").getByLabel("Why?").fill("A late receipt turned up");
  await page.getByRole("dialog").getByRole("button", { name: "Reopen month" }).click();
  await expect(page.getByText("Month reopened.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Close [A-Z][a-z]+ [0-9]{4}$/ })).toBeVisible();
});
