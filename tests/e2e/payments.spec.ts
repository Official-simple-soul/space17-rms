import { expect, test, type APIRequestContext } from "@playwright/test";
import { admin, confirm, createOrganisation, enrol, newClient, password, signIn } from "./helpers";

const inbox = process.env.MAILPIT_URL!;

/** The newest email to an address whose subject contains the text. */
async function findEmail(request: APIRequestContext, to: string, subject: string) {
  let body = "";
  await expect
    .poll(
      async () => {
        const list = await (
          await request.get(`${inbox}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
        ).json();
        const found = list.messages.find((m: { Subject: string }) => m.Subject.includes(subject));
        if (!found) return false;
        body = (await (await request.get(`${inbox}/api/v1/message/${found.ID}`)).json()).Text;
        return true;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return body;
}

async function setup(id: string) {
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);
  const org = (await admin.from("organisations").select("id").eq("slug", `acme-${id}`).single())
    .data!.id as string;
  return { owner, base, org };
}

test("finance pays in parts, staff confirm, and bank details stay protected", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const id = `y${Date.now().toString(36)}`;
  const { base, org } = await setup(id);
  const dept = (
    await admin
      .from("departments")
      .insert({ org_id: org, name: "Field", code: "FLD" })
      .select("id")
      .single()
  ).data!.id as string;
  const roleId = async (key: string) =>
    (await admin.from("roles").select("id").eq("org_id", org).eq("system_key", key).single()).data!
      .id as string;
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
    await admin.from("membership_roles").insert({
      org_id: org,
      membership_id: member.data!.id,
      role_id: await roleId(roleKey),
      // Approvers are given for a department.
      department_id: roleKey === "approver" ? dept : null,
    });
    await admin
      .from("department_members")
      .insert({ org_id: org, department_id: dept, membership_id: member.data!.id });
    const client = newClient();
    await client.auth.signInWithPassword({ email, password });
    return { email, client };
  };
  const approver = await add("Amaka", "approver");
  const staffUser = await add("Tunde", "staff");
  const finance = await add("Femi", "finance");
  const category = (
    await admin.from("categories").insert({ org_id: org, name: "Supplies" }).select("id").single()
  ).data!.id as string;
  const saved = await staffUser.client.rpc("save_request", {
    p_org: org,
    p_id: null,
    p_department: dept,
    p_category: category,
    p_title: "Printer paper",
    p_purpose: "Monthly supply",
    p_needed_by: null,
    p_supplier: "",
    p_provision: "money",
    p_items: [{ description: "Paper", quantity: 1, unit_price_minor: 5_000_000 }],
    p_lock: null,
  });
  expect(saved.error).toBeNull();
  const requestId = saved.data.id as string;
  expect(
    (await staffUser.client.rpc("submit_request", { p_id: requestId, p_lock: 1 })).error,
  ).toBeNull();
  const seen = (await approver.client.rpc("get_request", { p_id: requestId })).data;
  expect(
    (
      await approver.client.rpc("decide_request", {
        p_step: seen.active_step,
        p_lock: seen.lock_version,
        p_action: "approve",
        p_comment: null,
      })
    ).error,
  ).toBeNull();

  // The scheduled job sends what the app has not, and refuses strangers.
  expect((await request.get("/api/jobs/email")).status()).toBe(404);
  const job = await request.get("/api/jobs/email", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
  expect((await job.json()).failed).toBe(0);
  const mail = await findEmail(request, staffUser.email, "Your request was approved");
  expect(mail).toContain(`${base}/requests/${requestId}`);
  await findEmail(request, approver.email, "Tunde needs your approval");

  // Staff add bank details.
  await signIn(page, staffUser.email);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto(`${base}/requests/${requestId}`);
  await page.getByRole("link", { name: "Add your bank details" }).click();
  await page.getByLabel("Bank", { exact: true }).fill("GTBank");
  await page.getByLabel("Account name").fill("Tunde Ade");
  await page.getByLabel("Account number").fill("12345");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Enter the account number.").first()).toBeVisible();
  await page.getByLabel("Account number").fill("123456789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Nigerian accounts have 10 digits.").first()).toBeVisible();
  await page.getByLabel("Account number").fill("0123456789");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("•••• 6789").first()).toBeVisible();
  await expect(page.getByLabel("Account number")).toHaveValue("");
  await page.screenshot({ animations: "disabled", path: "test-results/bank.png" });
  await findEmail(request, staffUser.email, "Your bank details were changed");

  // Finance: MFA first, then reveal and part pay.
  const payer = await (await browser.newContext()).newPage();
  await signIn(payer, finance.email);
  await expect(payer).toHaveURL(new RegExp(`${base}$`));
  await payer.goto(`${base}/payments`);
  await expect(payer.getByText("Two-step verification is needed").first()).toBeVisible();
  await payer.getByRole("link", { name: /Printer paper/ }).click();
  await payer.getByRole("button", { name: "Reveal number" }).click();
  await expect(payer.getByText("Confirm two-step verification to continue").first()).toBeVisible();
  await payer.goto("/account");
  await enrol(payer);
  await expect(payer.getByText("Two-step verification is on.").first()).toBeVisible();
  await payer.goto(`${base}/payments`);
  await payer.screenshot({ animations: "disabled", path: "test-results/payments-due.png" });
  await payer.getByRole("link", { name: /Printer paper/ }).click();
  await expect(payer.getByTestId("account-number")).toHaveText("•••• 6789");
  await payer.getByRole("button", { name: "Reveal number" }).click();
  await expect(payer.getByTestId("account-number")).toHaveText("0123456789");
  await payer.getByRole("button", { name: "Record payment" }).click();
  const panel = payer.getByRole("dialog");
  await panel.getByLabel("Amount, NGN").fill("60,000");
  await expect(panel.getByText("Can't be more than ₦50,000.00.").first()).toBeVisible();
  await panel.getByLabel("Amount, NGN").fill("20,000");
  await panel.getByLabel("Reference").fill("TRF-1");
  await payer.screenshot({ animations: "disabled", path: "test-results/payment-form.png" });
  await panel.getByRole("button", { name: "Record payment" }).click();
  await expect(payer.getByRole("alertdialog")).toContainText("₦20,000.00");
  await confirm(payer);
  await expect(payer.getByText("Some money given", { exact: true }).first()).toBeVisible();
  await expect(payer.getByText(/PAY-\d{4}-0001/).first()).toBeVisible();
  await payer.locator('input[type="file"]:not([capture])').setInputFiles({
    name: "transfer.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nproof"),
  });
  await expect(payer.getByRole("link", { name: /transfer.pdf/ })).toBeVisible();
  await payer.getByRole("button", { name: "Record payment" }).click();
  await panel.getByRole("button", { name: "Record payment" }).click();
  await expect(payer.getByRole("alertdialog")).toContainText("₦30,000.00");
  await confirm(payer);
  await expect(payer.getByText("Money given", { exact: true }).first()).toBeVisible();
  await expect(payer.getByRole("button", { name: "Reveal number" })).toHaveCount(0);
  await payer.screenshot({
    animations: "disabled",
    path: "test-results/payment-done.png",
    fullPage: true,
  });
  await findEmail(request, staffUser.email, "A payment was recorded");

  // Staff confirm both; proof is visible to them.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/requests/${requestId}`);
  await expect(page.getByRole("link", { name: /transfer.pdf/ })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/m-payment.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "I received this" }).first().click();
  await confirm(page);
  await expect(page.getByRole("button", { name: "I received this" })).toHaveCount(1);
  await page.getByRole("button", { name: "I received this" }).click();
  await confirm(page);
  await expect(page.getByText("Money received", { exact: true }).first()).toBeVisible();

  // Void, then history.
  await payer.reload();
  await payer.getByRole("button", { name: /^Void PAY-\d{4}-0002/ }).click();
  await payer.getByLabel("Reason", { exact: true }).fill("Transfer bounced");
  await payer.getByRole("button", { name: "Void payment" }).click();
  await expect(payer.getByText("Voided: Transfer bounced").first()).toBeVisible();
  await expect(payer.getByText("Some money given", { exact: true }).first()).toBeVisible();
  await payer.goto(`${base}/payments?tab=history`);
  await expect(payer.getByText("1–2 of 2").first()).toBeVisible();
  await payer.getByLabel("Filter by status").selectOption("voided");
  await expect(payer.getByText("1–1 of 1").first()).toBeVisible();
  await payer.screenshot({ animations: "disabled", path: "test-results/payments-history.png" });
  await payer.setViewportSize({ width: 390, height: 844 });
  for (const path of ["payments", "payments?tab=history", "bank-details"]) {
    await payer.goto(`${base}/${path}`);
    await expect(payer.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await payer.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }

  // Others cannot open payments.
  await page.goto(`${base}/payments`);
  await expect(page.getByText("We couldn't find that page").first()).toBeVisible();
  // Email addresses in the queue were each used once.
  const left = await admin.from("email_outbox").select("status").eq("status", "failed");
  expect(left.data).toEqual([]);
});

test("staff join with a code after their email is confirmed and an admin approves", async ({
  page,
  browser,
  request,
}) => {
  const id = `j${Date.now().toString(36)}`;
  const { owner, base } = await setup(id);
  await signIn(page, owner);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto("/account");
  await enrol(page);
  await expect(page.getByText("Two-step verification is on.").first()).toBeVisible();
  await page.goto(`${base}/members?tab=requests`);
  await page.getByRole("button", { name: "Turn on" }).click();
  const code = (await page.locator("main code").textContent())!;
  expect(code).toMatch(/^[A-Z2-9]{10}$/);

  const email = `ngozi-${id}@test.local`;
  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/sign-in");
  await guest.getByRole("link", { name: "join code" }).click();
  await guest.getByLabel("Join code").fill("WRONGCODE2");
  await guest.getByLabel("Full name").fill("Ngozi Eze");
  await guest.getByLabel("Work email").fill(email);
  await guest.getByRole("button", { name: "Ask to join" }).click();
  await expect(guest.getByText("That code isn't valid.").first()).toBeVisible();
  await guest.getByLabel("Join code").fill(code.toLowerCase());
  await guest.getByRole("button", { name: "Ask to join" }).click();
  await expect(guest.getByText("Check your email to confirm").first()).toBeVisible();
  await expect(guest.getByRole("button", { name: "Ask to join" })).toHaveCount(0);
  await guest.screenshot({ animations: "disabled", path: "test-results/join.png" });
  // A known address gets the same answer.
  await guest.goto("/join");
  await guest.getByLabel("Join code").fill(code);
  await guest.getByLabel("Full name").fill("Ada Owner");
  await guest.getByLabel("Work email").fill(owner);
  await guest.getByRole("button", { name: "Ask to join" }).click();
  await expect(guest.getByText("Check your email to confirm").first()).toBeVisible();

  const check = await findEmail(request, email, "Confirm your request");
  await guest.goto(check.match(/http\S+\/join\/verify\/[a-f0-9]{64}/)![0]);
  await guest.getByRole("button", { name: "Confirm my email" }).click();
  await expect(guest.getByText("will review your request").first()).toBeVisible();
  await findEmail(request, owner, "Ngozi Eze asked to join");

  await page.reload();
  await page.getByRole("button", { name: "Approve Ngozi Eze" }).click();
  await page.getByLabel("Role", { exact: true }).selectOption({ label: "Staff" });
  await page.screenshot({ animations: "disabled", path: "test-results/join-requests.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(`We emailed ${email}`).first()).toBeVisible();
  const invite = await findEmail(request, email, "Join Acme");
  await guest.goto(invite.match(/http\S+\/join\/[a-f0-9]{64}/)![0]);
  await guest.getByLabel("Full name").fill("Ngozi Eze");
  await guest.getByLabel("Password", { exact: true }).fill(password);
  await guest.getByRole("button", { name: "Create account and join" }).click();
  await expect(guest.getByRole("heading", { name: "Hello, Ngozi" })).toBeVisible();

  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("button", { name: "Turn on" })).toBeVisible();
});
