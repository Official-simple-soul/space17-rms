import { expect, test } from "@playwright/test";
import { admin, confirm, createOrganisation, enrol, password, signIn } from "./helpers";

test("admin sets up categories and numbering", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const id = `c${Date.now().toString(36)}`;
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);
  const org = (await admin.from("organisations").select("id").eq("slug", `acme-${id}`).single())
    .data!.id as string;
  const add = async (name: string, roleKey: string) => {
    const user = await admin.auth.admin.createUser({
      email: `${name.toLowerCase()}-${id}@test.local`,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
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
      .eq("system_key", roleKey)
      .single();
    await admin
      .from("membership_roles")
      .insert({ org_id: org, membership_id: member.data!.id, role_id: role.data!.id });
  };
  await add("Amaka", "approver");
  await add("Femi", "finance");

  await signIn(page, owner);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto(`${base}/configuration`);
  await expect(page.getByText("Two-step verification is needed").first()).toBeVisible();
  await page.getByRole("button", { name: "Add these" }).click();
  await expect(page.getByText("Confirm two-step verification to continue").first()).toBeVisible();
  await page.goto("/account");
  await enrol(page);
  await expect(page.getByText("Two-step verification is on.").first()).toBeVisible();
  await page.goto(base);
  await expect(page.getByText("1 person can record payments.").first()).toBeVisible();
  await page.getByRole("button", { name: /Finish setting up/ }).click();
  await expect(page.locator("#setup")).toHaveClass(/attention-flash/);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/dashboard.png",
    fullPage: true,
  });

  // Categories are simple labels: starter set, add, rename, archive.
  await page.goto(`${base}/configuration`);
  await page.getByRole("button", { name: "Add these" }).click();
  await expect(page.getByRole("row", { name: /Food and kitchen/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add these" })).toHaveCount(0);
  await page.getByRole("button", { name: "Add category" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("food AND kitchen");
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  await expect(
    page.getByRole("dialog").getByText("There is already a category with that name."),
  ).toBeVisible();
  await page.getByRole("dialog").getByLabel("Name").fill("Field trips");
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("row", { name: /Field trips/ })).toBeVisible();
  await page.getByRole("button", { name: "Edit Field trips" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Outings");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: /Outings/ })).toBeVisible();
  await page.getByRole("button", { name: "Edit Outings" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
  await confirm(page);
  await expect(page.getByRole("row", { name: /Outings/ })).toHaveCount(0);
  await page.screenshot({ animations: "disabled", path: "test-results/categories.png" });

  // Numbering.
  await page.getByRole("link", { name: "Numbering" }).click();
  await page.getByRole("button", { name: "Edit Requests numbering" }).click();
  await page.getByLabel("Prefix").fill("rq");
  await page.getByLabel("Restart numbering").selectOption("never");
  await expect(page.getByRole("dialog").getByText("RQ-0001")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: /^Requests RQ-0001/ })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/numbering.png" });

  // Audit: server paging, filters and details.
  const extra = await admin.from("audit_logs").insert(
    Array.from({ length: 10 }, (_, n) => ({
      org_id: org,
      action: "example.added",
      entity_type: "example",
      reason: `Example ${n}`,
    })),
  );
  expect(extra.error).toBeNull();
  await page.goto(`${base}/audit`);
  await expect(page.getByText(/1–20 of \d+/).first()).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(/21–\d+ of \d+/).first()).toBeVisible();
  await page.getByLabel("Filter by area").selectOption("numbering");
  await expect(page.getByText("1–1 of 1").first()).toBeVisible();
  await page.getByRole("button", { name: /^View Numbering updated/ }).click();
  await expect(page.getByRole("dialog")).toContainText("REQ");
  await expect(page.getByRole("dialog")).toContainText("RQ");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Filter by to date").fill("2020-01-01");
  await expect(page.getByText("No matches").first()).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText(/1–20 of \d+/).first()).toBeVisible();
  await page.getByRole("searchbox").fill("outings");
  await expect(page.getByText("1–1 of 1").first()).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/audit.png" });

  // Other roles cannot open configuration.
  const approver = await (await browser.newContext()).newPage();
  await signIn(approver, `amaka-${id}@test.local`);
  await expect(approver).toHaveURL(new RegExp(`${base}$`));
  await expect(approver.getByText("need attention")).toHaveCount(0);
  for (const path of ["categories", "numbering"]) {
    await approver.goto(`${base}/configuration/${path}`);
    await expect(approver.getByText("We couldn't find that page").first()).toBeVisible();
  }

  // Mobile: More menu and no sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await expect(page.getByRole("heading", { name: "Hello, Ada" })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/mobile-dashboard.png",
    fullPage: true,
  });
  const bar = page.getByRole("navigation", { name: "Mobile" });
  await bar.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/mobile-more.png" });
  await page.getByRole("dialog").getByRole("link", { name: "Categories" }).click();
  await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const path of ["configuration/categories", "configuration/numbering", "audit"]) {
    await page.goto(`${base}/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/m-${path.replaceAll("/", "-")}.png`,
    });
  }
});
