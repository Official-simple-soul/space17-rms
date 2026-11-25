import { expect, test } from "@playwright/test";
import { admin, confirm, createOrganisation, enrol, password, signIn } from "./helpers";

test("admin configures categories, templates, workflows and numbering", async ({
  page,
  browser,
}) => {
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
  await expect(page.getByText("Two-step verification is needed")).toBeVisible();
  await page.getByRole("button", { name: "Add starter set" }).click();
  await expect(page.getByText("Confirm two-step verification to continue")).toBeVisible();
  await page.goto("/account");
  await enrol(page);
  await expect(page.getByText("Two-step verification is on.")).toBeVisible();
  await page.goto(base);
  await expect(page.getByText("1 person can record payments.").first()).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });

  await page.goto(`${base}/configuration`);
  await page.getByRole("button", { name: "Add starter set" }).click();
  await expect(page.getByRole("row", { name: /Travel and transport/ })).toContainText(
    /needs approvers/i,
  );
  await expect(page.getByRole("button", { name: "Add starter set" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/categories.png" });

  // Template: create, validate, preview, publish, keep the old version.
  await page.getByRole("link", { name: "Templates", exact: true }).click();
  await expect(page.getByRole("row", { name: /General request/ })).toBeVisible();
  await page.getByRole("link", { name: "New template" }).click();
  await page.getByLabel("Template name").fill("Trip request");
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Type").selectOption("dropdown");
  await page.getByLabel("Label").fill("Transport");
  await page.getByLabel("Options, one per line").fill("Road");
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByText("Dropdowns need at least two options.")).toBeVisible();
  await page.getByLabel("Options, one per line").fill("Road\nAir");
  await expect(page.getByLabel("Transport", { exact: true })).toContainText("Air");
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByRole("heading", { name: "Trip request" })).toBeVisible();
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Label").last().fill("Departure");
  await page.getByLabel("Type").last().selectOption("date");
  await page.getByRole("button", { name: "Move Departure up" }).click();
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.getByText("Version 2 published.")).toBeVisible();
  await page.screenshot({ path: "test-results/template.png", fullPage: true });
  // Publishing again from the same page must not look out of date.
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.getByText("Template saved.")).toBeVisible();
  await page.getByRole("button", { name: "View version 1" }).click();
  await expect(page.getByRole("dialog").getByLabel("Transport")).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Departure")).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();

  // A second tab that loaded the old version cannot overwrite a newer one.
  const stale = await page.context().newPage();
  await stale.goto(page.url());
  await page.getByRole("button", { name: "Remove Departure" }).click();
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.getByText("Version 3 published.")).toBeVisible();
  await stale.getByRole("button", { name: "Remove Transport" }).click();
  await stale.getByRole("button", { name: "Publish changes" }).click();
  await expect(stale.getByText("Someone published a newer version.")).toBeVisible();
  await stale.close();

  // Workflow with a threshold.
  await page.goto(`${base}/configuration/workflows/new`);
  await page.getByLabel("Workflow name").fill("Large spending");
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Step name").last().fill("Director");
  await page.getByLabel("Approved by").last().selectOption("member");
  await page.getByLabel("From amount, NGN").last().fill("five");
  await page.getByRole("button", { name: "Create workflow" }).click();
  await expect(page.getByText("Enter amounts above zero, such as 50,000.")).toBeVisible();
  await page.getByLabel("From amount, NGN").last().fill("250,000");
  await page.getByRole("button", { name: "Create workflow" }).click();
  await expect(page.getByText("Choose a person for each person step.")).toBeVisible();
  await page.getByLabel("Person", { exact: true }).selectOption({ label: "Amaka" });
  const result = page.getByRole("list", { name: "Steps for this amount" });
  await expect(result.getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Sample amount, NGN").fill("250,000");
  await expect(result.getByRole("listitem")).toHaveCount(2);
  await page.screenshot({ path: "test-results/workflow.png", fullPage: true });
  await page.getByRole("button", { name: "Create workflow" }).click();
  await expect(page.getByRole("heading", { name: "Large spending" })).toBeVisible();

  // Category using both.
  await page.goto(`${base}/configuration/categories/new`);
  await page.getByLabel("Name", { exact: true }).fill("Field trips");
  await page.getByLabel("Code").fill("trv");
  await page.getByLabel("Request template").selectOption({ label: "Trip request" });
  await page.getByLabel("Approval workflow").selectOption({ label: "Large spending" });
  await page.getByRole("button", { name: "Add approver" }).click();
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("Choose a person or role for every approver.")).toBeVisible();
  await page.getByLabel("Approver 1", { exact: true }).selectOption({ label: "Amaka" });
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("That value is already in use.")).toBeVisible();
  await page.getByLabel("Code").fill("trip");
  await page.getByRole("button", { name: "Create category" }).click();
  await page.getByRole("link", { name: "Field trips" }).click();
  await expect(page.getByText("1 person can approve, 2 needed")).toBeVisible();
  await expect(page.getByLabel("Approval workflow")).toHaveValue(/.+/);
  await page.screenshot({ path: "test-results/category.png", fullPage: true });

  // In-use template is protected; the category itself can be archived.
  const category = page.url();
  await page.goto(`${base}/configuration/templates`);
  await page.getByRole("link", { name: "Trip request" }).click();
  await page.getByRole("button", { name: "Archive template" }).click();
  await page.screenshot({ path: "test-results/confirm.png" });
  await confirm(page);
  await expect(page.getByText("Choose another template in the categories")).toBeVisible();
  await page.goto(category);
  await page.getByRole("button", { name: "Archive category" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(category);
  await page.getByRole("button", { name: "Archive category" }).click();
  await confirm(page);
  await expect(page).toHaveURL(/configuration\/categories$/);
  await expect(page.getByRole("link", { name: "Field trips" })).toHaveCount(0);

  // Numbering.
  await page.getByRole("link", { name: "Numbering" }).click();
  await page.getByRole("button", { name: "Edit Requests numbering" }).click();
  await page.getByLabel("Prefix").fill("rq");
  await page.getByLabel("Restart numbering").selectOption("never");
  await expect(page.getByRole("dialog").getByText("RQ-0001")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("row", { name: /^Requests RQ-0001/ })).toBeVisible();
  await page.screenshot({ path: "test-results/numbering.png" });

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
  await expect(page.getByText(/1–20 of \d+/)).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(/21–\d+ of \d+/)).toBeVisible();
  await page.getByLabel("Filter by area").selectOption("numbering");
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await page.getByRole("button", { name: /^View Numbering updated/ }).click();
  await expect(page.getByRole("dialog")).toContainText("REQ");
  await expect(page.getByRole("dialog")).toContainText("RQ");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByLabel("Filter by to date").fill("2020-01-01");
  await expect(page.getByText("No matches")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText(/1–20 of \d+/)).toBeVisible();
  await page.getByRole("searchbox").fill("field trips");
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await page.screenshot({ path: "test-results/audit.png" });

  // Other roles cannot open configuration.
  const approver = await (await browser.newContext()).newPage();
  await signIn(approver, `amaka-${id}@test.local`);
  await expect(approver).toHaveURL(new RegExp(`${base}$`));
  await expect(approver.getByText("need attention")).toHaveCount(0);
  for (const path of ["categories", "templates/new", "numbering"]) {
    await approver.goto(`${base}/configuration/${path}`);
    await expect(approver.getByText("We couldn't find that page")).toBeVisible();
  }

  // Mobile: More menu and no sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await expect(page.getByRole("heading", { name: "Hello, Ada" })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-dashboard.png", fullPage: true });
  const bar = page.getByRole("navigation", { name: "Mobile" });
  await bar.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-more.png" });
  await page.getByRole("dialog").getByRole("link", { name: "Configuration" }).click();
  await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const path of [
    "configuration/categories",
    "configuration/categories/new",
    "configuration/templates/new",
    "configuration/workflows/new",
    "configuration/numbering",
    "audit",
  ]) {
    await page.goto(`${base}/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
    await page.screenshot({ path: `test-results/m-${path.replaceAll("/", "-")}.png` });
  }
});
