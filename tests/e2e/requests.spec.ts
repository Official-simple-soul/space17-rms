import { expect, test } from "@playwright/test";
import { admin, confirm, createOrganisation, enrol, password, signIn } from "./helpers";

test("staff ask, the department approver returns, reduces and approves", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
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
    // Approvers are given for a department.
    await admin.from("membership_roles").insert({
      org_id: org,
      membership_id: member.data!.id,
      role_id: role.data!.id,
      department_id: roleKey === "approver" ? dept : null,
    });
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
  await expect(page.getByText("Two-step verification is on.").first()).toBeVisible();
  await page.goto(`${base}/configuration`);
  await page.getByRole("button", { name: "Add these" }).click();
  await expect(page.getByRole("row", { name: /Supplies/ })).toBeVisible();

  // Staff: no setup needed, the form says who approves; autosave, validate, upload, send.
  const staff = await (await browser.newContext()).newPage();
  await signIn(staff, staffEmail);
  await expect(staff).toHaveURL(new RegExp(`${base}$`));
  await staff.getByRole("link", { name: /Ask for something/ }).click();
  await expect(staff.getByText("Amaka will approve this.").first()).toBeVisible();
  await expect(staff.getByLabel("Which department is this for?")).toHaveCount(0);
  await staff.getByRole("button", { name: "Send request" }).click();
  await expect(staff.getByText("Say what you need.").first()).toBeVisible();
  await expect(staff.getByText("Enter how much it will cost.").first()).toBeVisible();
  await expect(staff.getByText("Choose how you'd like it.").first()).toBeVisible();
  await staff.getByLabel("What do you need?").fill("Printer paper");
  await expect(staff).toHaveURL(/new\?draft=/, { timeout: 15_000 });
  await expect(staff.getByText("Draft saved").first()).toBeVisible();
  await expect(staff.getByText("Not saved yet")).toHaveCount(0);
  await staff.getByLabel("Why do you need it?").fill("Monthly office supply");
  await staff.getByText("Give me the money").click();
  await staff.getByRole("button", { name: "List items separately" }).click();
  await staff.getByLabel("Item 1", { exact: true }).fill("A4 paper");
  await staff.getByLabel("Quantity").fill("4");
  await staff.getByLabel("Unit price, NGN").fill("3,500");
  await expect(staff.getByText("₦14,000.00").first()).toBeVisible();

  const upload = staff.locator('input[type="file"]:not([capture])');
  await upload
    .first()
    .setInputFiles({ name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>") });
  await expect(staff.getByText("That file couldn't be read.").first()).toBeVisible();
  await staff.getByRole("button", { name: "Dismiss" }).click();
  await upload.first().setInputFiles({
    name: "list.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nprice list"),
  });
  await expect(staff.getByRole("button", { name: "Remove list.pdf" })).toBeVisible();
  await staff.getByText("More options").click();
  await staff.getByLabel("Where to buy it").fill("Office Mart");
  await upload.last().setInputFiles({
    name: "quote.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
  });
  await expect(staff.getByRole("button", { name: "Remove quote.png" })).toBeVisible();
  await expect(staff.getByText("Take photo").first()).toBeHidden();
  await staff.screenshot({
    animations: "disabled",
    path: "test-results/request-edit.png",
    fullPage: true,
  });

  // A reload keeps the draft.
  await expect(staff.getByText("Draft saved").first()).toBeVisible();
  await staff.reload();
  await expect(staff.getByLabel("What do you need?")).toHaveValue("Printer paper");
  await expect(staff.getByLabel("Where to buy it")).toHaveValue("Office Mart");
  await expect(staff.getByLabel("Unit price, NGN")).toHaveValue("3500.00");
  await expect(staff.getByRole("button", { name: "Remove quote.png" })).toBeVisible();

  // On a phone the camera can be opened directly.
  const phone = await (
    await browser.newContext({
      storageState: await staff.context().storageState(),
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    })
  ).newPage();
  await phone.goto(staff.url());
  await expect(phone.getByText(/^Take photo/)).toHaveCount(2);
  await expect(phone.getByText(/^Take photo/).first()).toBeVisible();
  await expect(phone.getByText(/quote or proforma invoice/).first()).toBeVisible();
  await phone
    .locator('input[capture="environment"]')
    .first()
    .setInputFiles({
      name: "snap.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
    });
  await expect(phone.getByRole("button", { name: "Remove snap.png" })).toBeVisible();
  await phone.screenshot({
    animations: "disabled",
    path: "test-results/m-request-photo.png",
    fullPage: true,
  });
  await phone.context().close();

  // A second tab that saved first stops this one from overwriting.
  const second = await staff.context().newPage();
  await second.goto(staff.url());
  await second.getByLabel("What do you need?").fill("Printer paper and ink");
  await expect(second.getByText("Draft saved").first()).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await admin.from("requests").select("title").eq("org_id", org).single();
      return data?.title;
    })
    .toBe("Printer paper and ink");
  await second.close();
  await staff.getByLabel("What do you need?").fill("Old title");
  await expect(
    staff.getByText("This request has changed since you opened it.").first(),
  ).toBeVisible();
  // The page is still dirty, so the browser asks before leaving it.
  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Reload" }).click();
  await expect(staff.getByLabel("What do you need?")).toHaveValue("Printer paper and ink");

  // With one approver and one requester, submission works; nobody else sees the draft.
  const other = await (await browser.newContext()).newPage();
  await signIn(other, otherEmail);
  await expect(other).toHaveURL(new RegExp(`${base}$`));
  const detail = staff.url().replace("new?draft=", "");
  await other.goto(detail);
  await expect(other.getByText("We couldn't find that page").first()).toBeVisible();
  await staff.getByRole("button", { name: "Send request" }).click();
  await expect(staff.getByText("Request sent.").first()).toBeVisible();
  await expect(staff).toHaveURL(detail);
  await expect(staff.getByText(/REQ-\d{4}-0001/).first()).toBeVisible();
  await expect(staff.getByText("Waiting for Amaka").first()).toBeVisible();
  await expect(staff.getByText("You can't approve your own request.").first()).toBeVisible();
  await expect(staff.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(staff.getByText("Office Mart").first()).toBeVisible();
  await staff.screenshot({
    animations: "disabled",
    path: "test-results/request-detail.png",
    fullPage: true,
  });

  // Files open for people who may see the request, and only for them.
  const file = await staff.getByRole("link", { name: /list.pdf/ }).getAttribute("href");
  expect((await staff.request.get(file!)).status()).toBe(200);
  await other.goto(detail);
  await expect(other.getByText("We couldn't find that page").first()).toBeVisible();
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
  await approver.screenshot({ animations: "disabled", path: "test-results/m-approvals.png" });
  await approver.getByRole("link", { name: /Printer paper and ink/ }).click();
  await approver.getByRole("button", { name: "Return", exact: true }).click();
  await approver.getByRole("button", { name: "Return request" }).click();
  await expect(approver.getByText("Give a reason of at least 5 characters.").first()).toBeVisible();
  await approver.getByLabel("Reason", { exact: true }).fill("Please add ink cartridges");
  await approver.getByRole("button", { name: "Return request" }).click();
  await expect(approver.getByText("Returned", { exact: true }).first()).toBeVisible();

  // Requester is notified, edits and resubmits.
  await staff.goto(base);
  await staff.getByRole("link", { name: /Notifications/ }).click();
  await expect(staff.getByText(/Amaka returned your request/).first()).toBeVisible();
  await staff.screenshot({ animations: "disabled", path: "test-results/notifications.png" });
  await staff.getByRole("link", { name: /Amaka returned your request/ }).click();
  await staff.getByRole("link", { name: "Edit and resubmit" }).click();
  await staff.getByRole("button", { name: "Add item" }).click();
  await staff.getByLabel("Item 2", { exact: true }).fill("Ink");
  await staff.getByLabel("Unit price, NGN").last().fill("10,000");
  await staff.getByRole("button", { name: "Send request" }).click();
  await expect(staff).toHaveURL(detail);
  await expect(staff.getByText("Waiting for approval").first()).toBeVisible();

  // Approver reduces an amount. An outdated tab is told, not obeyed.
  await approver.goto(detail);
  await approver.getByRole("button", { name: "Approve", exact: true }).click();
  const panel = approver.getByRole("dialog");
  await panel.getByLabel("Ink").fill("20,000");
  await expect(panel.getByText("Can't be more than ₦10,000.00.").first()).toBeVisible();
  await panel.getByLabel("Ink").fill("8,000");
  await expect(panel.getByText("₦22,000.00").first()).toBeVisible();
  await approver.screenshot({ animations: "disabled", path: "test-results/m-approve.png" });
  await panel.getByRole("button", { name: "Approve" }).click();
  await expect(panel.getByText("Say why you reduced the amount.").first()).toBeVisible();
  await panel.getByLabel("Reason for the reduction").fill("Cheaper supplier found");
  const old = await approver.context().newPage();
  await old.goto(detail, { waitUntil: "networkidle" });
  await old.getByRole("button", { name: "Approve", exact: true }).click();
  await approver.bringToFront();
  await panel.getByRole("button", { name: "Approve" }).click();
  await expect(panel).toHaveCount(0);
  await expect(approver.getByText("Approved total").first()).toBeVisible();
  expect(await approver.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await approver.screenshot({
    animations: "disabled",
    path: "test-results/m-request.png",
    fullPage: true,
  });
  await old.bringToFront();
  await old.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(
    old.getByText("This request has changed since you opened it.").first(),
  ).toBeVisible();

  await staff.reload();
  await expect(
    staff.getByText("Amaka approved (Approval), reduced to ₦22,000.00").first(),
  ).toBeVisible();
  await staff.getByLabel("Your message").fill("Thank you");
  await staff.getByRole("button", { name: "Send", exact: true }).click();
  await expect(staff.getByText("Message sent.").first()).toBeVisible();
  await expect(staff.getByLabel("Your message")).toHaveValue("");
  await expect(staff.getByRole("list", { name: "Messages" })).toContainText("Thank you");
  await staff.screenshot({
    animations: "disabled",
    path: "test-results/request-approved.png",
    fullPage: true,
  });

  // Delete a draft; admins see everything submitted but no drafts.
  await staff.goto(`${base}/requests/new`);
  await staff.getByLabel("What do you need?").fill("Spare chairs");
  await expect(staff).toHaveURL(/new\?draft=/, { timeout: 15_000 });
  await expect(staff.getByRole("button", { name: "Delete draft" })).toBeVisible();
  await staff.goto(`${base}/requests`);
  await expect(staff.getByRole("row", { name: /Spare chairs/ })).toBeVisible();
  await page.goto(`${base}/requests?tab=all`);
  await expect(page.getByRole("row", { name: /Printer paper and ink/ })).toBeVisible();
  await expect(page.getByText("Spare chairs")).toHaveCount(0);
  await page.screenshot({ animations: "disabled", path: "test-results/requests-all.png" });
  await staff.getByRole("link", { name: "Spare chairs" }).click();
  await staff.getByRole("button", { name: "Delete draft" }).click();
  await staff.getByRole("alertdialog").getByRole("button", { name: "Delete draft" }).click();
  await expect(staff.getByText("Draft deleted.").first()).toBeVisible();
  await expect(staff).toHaveURL(/\/requests$/);
  await expect(staff.getByText("Spare chairs")).toHaveCount(0);

  // One amount is enough; withdraw.
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
  await staff.getByLabel("What do you need?").fill("Bus fare");
  await staff.getByLabel("Why do you need it?").fill("Trip to the market");
  await staff.getByText("Give me the money").click();
  await staff.getByLabel("How much do you need?").fill("4,500");
  await expect(staff.getByText("₦4,500.00").first()).toBeVisible();
  await staff.screenshot({
    animations: "disabled",
    path: "test-results/m-request-edit.png",
    fullPage: true,
  });
  expect(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await staff.getByRole("button", { name: "Send request" }).click();
  await expect(staff.getByText("Waiting for Amaka").first()).toBeVisible();
  await expect(staff.getByText("₦4,500.00").first()).toBeVisible();
  await staff.getByRole("button", { name: "Withdraw" }).click();
  await staff.getByLabel("Reason", { exact: true }).fill("No longer needed");
  await staff.getByRole("button", { name: "Withdraw request" }).click();
  await expect(staff.getByText("Withdrawn", { exact: true }).first()).toBeVisible();

  // An admin can approve as backup, without being alerted about every request.
  await staff.goto(`${base}/requests/new`);
  await staff.getByLabel("What do you need?").fill("Gas refill");
  await staff.getByLabel("Why do you need it?").fill("For cooking");
  await staff.getByText("Give me the money").click();
  await staff.getByLabel("How much do you need?").fill("12,000");
  await staff.getByRole("button", { name: "Send request" }).click();
  await expect(staff.getByText("Waiting for Amaka").first()).toBeVisible();

  // A small badge on the All requests tab counts what is waiting.
  await page.goto(`${base}/requests?tab=all`);
  await expect(page.getByRole("link", { name: "All requests 1 waiting" })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/requests-tab-badge.png" });

  // The approver asks a question; the requester is told and answers in the conversation.
  await approver.goto(staff.url());
  await approver.getByLabel("Your message").fill("Is this the big cylinder?");
  await approver.getByLabel("Ask Tunde to answer this").check();
  await approver.getByRole("button", { name: "Send question" }).click();
  await expect(approver.getByText("Question sent.").first()).toBeVisible();
  await staff.reload();
  await expect(staff.getByText("Amaka asked you a question.").first()).toBeVisible();
  await staff.getByRole("link", { name: "Answer it" }).click();
  await staff.getByLabel("Your message").fill("Yes, the 12.5 kg one");
  await staff.getByRole("button", { name: "Send", exact: true }).click();
  await expect(staff.getByText("Message sent.").first()).toBeVisible();
  await expect(staff.getByText("asked you a question")).toHaveCount(0);
  await staff.screenshot({
    animations: "disabled",
    path: "test-results/m-request-chat.png",
    fullPage: true,
  });
  await page.goto(staff.url());
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Ada Owner approved/).first()).toBeVisible();

  // Provided: no amount needed, handed over by the approver, confirmed by the requester.
  await staff.goto(`${base}/requests/new`);
  await staff.getByLabel("What do you need?").fill("Laptop for homework");
  await staff.getByLabel("Why do you need it?").fill("School projects");
  await staff.getByText("Provide it for me").click();
  await expect(staff.getByLabel("Roughly what does it cost? (optional)")).toBeVisible();
  await staff.getByRole("button", { name: "Send request" }).click();
  await expect(staff).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);
  const laptop = staff.url();
  await approver.goto(laptop);
  await approver.getByRole("button", { name: "Approve", exact: true }).click();
  await approver.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(approver.getByText("Approved, being provided").first()).toBeVisible();
  await expect(
    approver.getByRole("link", { name: "Add the purchase as an expense" }),
  ).toHaveAttribute("href", /expenses\/new\?request=/);
  await approver.getByLabel("Note (optional)").fill("Office laptop L-07");
  await approver.getByRole("button", { name: "Mark as handed over" }).click();
  await confirm(approver);
  await expect(approver.getByText("Waiting for Tunde to confirm.").first()).toBeVisible();
  await staff.reload();
  await expect(staff.getByText("Have you got it?").first()).toBeVisible();
  await staff.screenshot({
    animations: "disabled",
    path: "test-results/m-item-confirm.png",
    fullPage: true,
  });
  await staff.getByRole("button", { name: "I've got it" }).click();
  await expect(staff.getByText("Done", { exact: true }).first()).toBeVisible();
});
