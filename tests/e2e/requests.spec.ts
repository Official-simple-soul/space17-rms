import { expect, test } from "@playwright/test";
import { admin, createOrganisation, enrol, password, signIn } from "./helpers";

test("staff request, approver returns, reduces and approves", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const id = `r${Date.now().toString(36)}`;
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);
  const org = (await admin.from("organisations").select("id").eq("slug", `acme-${id}`).single())
    .data!.id as string;
  const dept = (
    await admin
      .from("departments")
      .insert({ org_id: org, name: "Field", code: "FLD" })
      .select("id")
      .single()
  ).data!.id as string;
  const add = async (name: string, roleKey: string) => {
    const email = `${name.toLowerCase()}-${id}@test.local`;
    const user = await admin.auth.admin.createUser({
      email,
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
    await admin
      .from("department_members")
      .insert({ org_id: org, department_id: dept, membership_id: member.data!.id });
    return email;
  };
  const approverEmail = await add("Amaka", "approver");
  const staffEmail = await add("Tunde", "staff");
  const otherEmail = await add("Zainab", "staff");

  await signIn(page, owner);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto("/account");
  await enrol(page);
  await expect(page.getByText("Two-step verification is on.")).toBeVisible();
  await page.goto(`${base}/configuration`);
  await page.getByRole("button", { name: "Add starter set" }).click();
  await expect(page.getByRole("row", { name: /Office supplies/ })).toBeVisible();

  // Staff: start, autosave, validate, upload, submit.
  const staff = await (await browser.newContext()).newPage();
  await signIn(staff, staffEmail);
  await expect(staff).toHaveURL(new RegExp(`${base}$`));
  await staff.getByRole("link", { name: "New request" }).click();
  await staff.getByLabel("What do you need?").selectOption({ label: "Office supplies" });
  await staff.getByRole("button", { name: "Continue" }).click();
  await expect(staff).toHaveURL(/\/edit$/);
  await staff.getByLabel("Title").fill("Printer paper");
  await expect(staff.getByText("Draft saved")).toBeVisible();
  await expect(staff.getByText("Not saved yet")).toHaveCount(0);
  await staff.getByRole("button", { name: "Submit request" }).click();
  await expect(staff.getByText("Say what this is for.")).toBeVisible();
  await expect(staff.getByText("This is required.")).toBeVisible();
  await staff.getByLabel("Purpose").fill("Monthly office supply");
  await staff.getByLabel("Why is this needed?").fill("We have run out.");
  await expect(staff.getByText("This is required.")).toHaveCount(0);
  await staff.getByRole("button", { name: "Add item" }).click();
  await staff.getByLabel("Item 1", { exact: true }).fill("A4 paper");
  await staff.getByLabel("Quantity").fill("4");
  await staff.getByLabel("Unit price, NGN").fill("3,500");
  await expect(staff.getByText("₦14,000.00").first()).toBeVisible();

  const upload = staff.locator('input[type="file"]');
  await upload
    .last()
    .setInputFiles({ name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>") });
  await expect(staff.getByText("That file couldn't be read.")).toBeVisible();
  await staff.getByRole("button", { name: "Dismiss" }).click();
  await upload.last().setInputFiles({
    name: "list.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nprice list"),
  });
  await expect(staff.getByRole("button", { name: "Remove list.pdf" })).toBeVisible();
  await upload.first().setInputFiles({
    name: "quote.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
  });
  await expect(staff.getByRole("button", { name: "Remove quote.png" })).toBeVisible();
  await staff.screenshot({ path: "test-results/request-edit.png", fullPage: true });

  // A reload keeps the draft.
  await expect(staff.getByText("Draft saved")).toBeVisible();
  await staff.reload();
  await expect(staff.getByLabel("Title")).toHaveValue("Printer paper");
  await expect(staff.getByLabel("Unit price, NGN")).toHaveValue("3500.00");
  await expect(staff.getByRole("button", { name: "Remove quote.png" })).toBeVisible();

  // A second tab that saved first stops this one from overwriting.
  const second = await staff.context().newPage();
  await second.goto(staff.url());
  await second.getByLabel("Title").fill("Printer paper and ink");
  await expect(second.getByText("Draft saved")).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await admin.from("requests").select("title").eq("org_id", org).single();
      return data?.title;
    })
    .toBe("Printer paper and ink");
  await second.close();
  await staff.getByLabel("Title").fill("Old title");
  await expect(staff.getByText("This request has changed since you opened it.")).toBeVisible();
  // The page is still dirty, so the browser asks before leaving it.
  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Reload" }).click();
  await expect(staff.getByLabel("Title")).toHaveValue("Printer paper and ink");

  // With one approver and one requester, submission works; nobody else sees the draft.
  const other = await (await browser.newContext()).newPage();
  await signIn(other, otherEmail);
  await expect(other).toHaveURL(new RegExp(`${base}$`));
  const detail = staff.url().replace(/\/edit$/, "");
  await other.goto(detail);
  await expect(other.getByText("We couldn't find that page")).toBeVisible();
  await staff.getByRole("button", { name: "Submit request" }).click();
  await expect(staff).toHaveURL(detail);
  await expect(staff.getByText(/REQ-\d{4}-0001/).first()).toBeVisible();
  await expect(staff.getByText("Waiting for Amaka")).toBeVisible();
  await expect(staff.getByText("You can't approve your own request.")).toBeVisible();
  await expect(staff.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await staff.screenshot({ path: "test-results/request-detail.png", fullPage: true });

  // Files open for people who may see the request, and only for them.
  const file = await staff.getByRole("link", { name: /list.pdf/ }).getAttribute("href");
  expect((await staff.request.get(file!)).status()).toBe(200);
  await other.goto(detail);
  await expect(other.getByText("We couldn't find that page")).toBeVisible();
  expect((await other.request.get(file!)).status()).toBe(404);

  // Approver: badge, inbox, return.
  const approver = await (await browser.newContext()).newPage();
  await approver.setViewportSize({ width: 390, height: 844 });
  await signIn(approver, approverEmail);
  await expect(approver).toHaveURL(new RegExp(`${base}$`));
  await approver
    .getByRole("navigation", { name: "Mobile" })
    .getByRole("link", { name: /Approvals/ })
    .click();
  await expect(approver.getByRole("row", { name: /Printer paper and ink/ })).toBeVisible();
  await approver.screenshot({ path: "test-results/m-approvals.png" });
  await approver.getByRole("link", { name: /Printer paper and ink/ }).click();
  await approver.getByRole("button", { name: "Return", exact: true }).click();
  await approver.getByRole("button", { name: "Return request" }).click();
  await expect(approver.getByText("Give a reason of at least 5 characters.")).toBeVisible();
  await approver.getByLabel("Reason", { exact: true }).fill("Please add ink cartridges");
  await approver.getByRole("button", { name: "Return request" }).click();
  await expect(approver.getByText("Returned", { exact: true }).first()).toBeVisible();

  // Requester is notified, edits and resubmits.
  await staff.goto(base);
  await staff.getByRole("link", { name: /Notifications/ }).click();
  await expect(staff.getByText(/Amaka returned your request/)).toBeVisible();
  await staff.screenshot({ path: "test-results/notifications.png" });
  await staff.getByRole("link", { name: /Amaka returned your request/ }).click();
  await staff.getByRole("link", { name: "Edit and resubmit" }).click();
  await staff.getByRole("button", { name: "Add item" }).click();
  await staff.getByLabel("Item 2", { exact: true }).fill("Ink");
  await staff.getByLabel("Unit price, NGN").last().fill("10,000");
  await staff.getByRole("button", { name: "Submit request" }).click();
  await expect(staff).toHaveURL(detail);
  await expect(staff.getByText("Awaiting approval")).toBeVisible();

  // Approver reduces an amount. An outdated tab is told, not obeyed.
  await approver.goto(detail);
  await approver.getByRole("button", { name: "Approve", exact: true }).click();
  const panel = approver.getByRole("dialog");
  await panel.getByLabel("Ink").fill("20,000");
  await expect(panel.getByText("Can't be more than ₦10,000.00.")).toBeVisible();
  await panel.getByLabel("Ink").fill("8,000");
  await expect(panel.getByText("₦22,000.00")).toBeVisible();
  await approver.screenshot({ path: "test-results/m-approve.png" });
  await panel.getByRole("button", { name: "Approve" }).click();
  await expect(panel.getByText("Say why you reduced the amount.")).toBeVisible();
  await panel.getByLabel("Reason for the reduction").fill("Cheaper supplier found");
  const old = await approver.context().newPage();
  await old.goto(detail, { waitUntil: "networkidle" });
  await old.getByRole("button", { name: "Approve", exact: true }).click();
  await approver.bringToFront();
  await panel.getByRole("button", { name: "Approve" }).click();
  await expect(panel).toHaveCount(0);
  await expect(approver.getByText("Approved total")).toBeVisible();
  expect(await approver.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await approver.screenshot({ path: "test-results/m-request.png", fullPage: true });
  await old.bringToFront();
  await old.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(
    old.getByText("This request has changed since you opened it.").first(),
  ).toBeVisible();

  await staff.reload();
  await expect(staff.getByText("Amaka approved (Approval), reduced to ₦22,000.00")).toBeVisible();
  await staff.getByLabel("Add a comment").fill("Thank you");
  await staff.getByRole("button", { name: "Comment" }).click();
  await expect(staff.getByText("Tunde commented")).toBeVisible();
  await expect(staff.getByLabel("Add a comment")).toHaveValue("");
  await staff.screenshot({ path: "test-results/request-approved.png", fullPage: true });

  // Delete a draft; admins see everything submitted but no drafts.
  await staff.goto(`${base}/requests/new`);
  await staff.getByLabel("What do you need?").selectOption({ label: "Equipment" });
  await staff.getByRole("button", { name: "Continue" }).click();
  await expect(staff).toHaveURL(/\/edit$/);
  await staff.goto(`${base}/requests`);
  await expect(staff.getByRole("row", { name: /Untitled request/ })).toBeVisible();
  await page.goto(`${base}/requests?tab=all`);
  await expect(page.getByRole("row", { name: /Printer paper and ink/ })).toBeVisible();
  await expect(page.getByText("Untitled request")).toHaveCount(0);
  await page.screenshot({ path: "test-results/requests-all.png" });
  await staff.getByRole("link", { name: "Untitled request" }).click();
  await staff.getByRole("button", { name: "Delete draft" }).click();
  await staff.getByRole("alertdialog").getByRole("button", { name: "Delete draft" }).click();
  await expect(staff).toHaveURL(/\/requests$/);
  await expect(staff.getByText("Untitled request")).toHaveCount(0);

  // Withdraw.
  await staff.goto(`${base}/requests/new`);
  await staff.getByLabel("What do you need?").selectOption({ label: "Equipment" });
  await staff.getByRole("button", { name: "Continue" }).click();
  await staff.getByLabel("Title").fill("Use the van");
  await staff.getByLabel("Purpose").fill("Moving boxes");
  await staff.getByLabel("Why is this needed?").fill("Office move");
  await staff.getByRole("button", { name: "Submit request" }).click();
  await staff.getByRole("button", { name: "Withdraw" }).click();
  await staff.getByLabel("Reason", { exact: true }).fill("No longer needed");
  await staff.getByRole("button", { name: "Withdraw request" }).click();
  await expect(staff.getByText("Withdrawn", { exact: true })).toBeVisible();

  // Admin reassigns a waiting approval.
  await staff.setViewportSize({ width: 390, height: 844 });
  for (const path of ["requests", "requests/new", "notifications"]) {
    await staff.goto(`${base}/${path}`);
    await expect(staff.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  await staff.goto(`${base}/requests/new`);
  await staff.getByLabel("What do you need?").selectOption({ label: "Equipment" });
  await staff.getByRole("button", { name: "Continue" }).click();
  await expect(staff.getByLabel("Title")).toBeVisible();
  await staff.screenshot({ path: "test-results/m-request-edit.png", fullPage: true });
  expect(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await staff.getByLabel("Title").fill("Use the hall");
  await staff.getByLabel("Purpose").fill("Training day");
  await staff.getByLabel("Why is this needed?").fill("Training");
  await staff.getByRole("button", { name: "Submit request" }).click();
  await expect(staff.getByText("Waiting for Amaka")).toBeVisible();
  await page.goto(staff.url());
  await page.getByRole("button", { name: "Reassign" }).click();
  await page.getByLabel("To", { exact: true }).selectOption({ label: "Amaka" });
  await page.getByLabel("Reason", { exact: true }).fill("Only approver available");
  await page.getByRole("dialog").getByRole("button", { name: "Reassign" }).click();
  await expect(page.getByText("To Amaka: Only approver available")).toBeVisible();
});
