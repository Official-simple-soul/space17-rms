import { expect, test, type Page } from "@playwright/test";
import { admin, confirm, createOrganisation, newClient, password, signIn } from "./helpers";

const receipt = {
  name: "receipt.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\nreceipt"),
};

async function fillExpense(page: Page, what: string, seller: string, price: string) {
  await page.getByLabel("What was it for?").fill(what);
  await page.getByLabel("Category").selectOption({ label: "Supplies" });
  await page.getByLabel("Seller's name or description").fill(seller);
  await page.getByLabel("Item 1", { exact: true }).fill(what);
  await page.getByLabel("Unit price, NGN").fill(price);
}

const fits = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("staff enter expenses, the head reviews them and submits the monthly report", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const id = `x${Date.now().toString(36)}`;
  const base = await createOrganisation(id, `boss-${id}@test.local`);
  const org = (await admin.from("organisations").select("id").eq("slug", `acme-${id}`).single())
    .data!.id as string;
  const dept = (
    await admin
      .from("departments")
      .insert({ org_id: org, name: "Field", code: "FLD" })
      .select("id")
      .single()
  ).data!.id as string;
  const add = async (name: string, roles: [string, string | null][]) => {
    const email = `${name.toLowerCase()}-${id}@test.local`;
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    const member = (
      await admin
        .from("memberships")
        .insert({ org_id: org, user_id: user.data.user!.id })
        .select("id")
        .single()
    ).data!.id as string;
    for (const [key, department] of roles) {
      const role = await admin
        .from("roles")
        .select("id")
        .eq("org_id", org)
        .eq("system_key", key)
        .single();
      const granted = await admin.from("membership_roles").insert({
        org_id: org,
        membership_id: member,
        role_id: role.data!.id,
        department_id: department,
      });
      expect(granted.error).toBeNull();
    }
    await admin
      .from("department_members")
      .insert({ org_id: org, department_id: dept, membership_id: member });
    return email;
  };
  const staff = await add("Tunde", [["staff", null]]);
  const head = await add("Halima", [["hod", dept]]);
  const finance = await add("Femi", [["finance", null]]);
  await admin.from("categories").insert({ org_id: org, name: "Supplies" });

  // Staff: one with a receipt, one without.
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, staff);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto(`${base}/expenses/new`);
  await page.getByRole("button", { name: "Submit expense" }).click();
  await expect(page.getByText("Say what was bought.").first()).toBeVisible();
  await expect(page.getByText("Add the receipt.").first()).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/expense-mobile.png",
    fullPage: true,
  });
  expect(await fits(page)).toBe(true);
  await fillExpense(page, "Printer paper", "Office Mart", "12,500");
  await page.evaluate(() => document.body.setAttribute("data-same-page", ""));
  await page.locator('input[type="file"]:not([capture])').setInputFiles(receipt);
  await expect(page.getByRole("button", { name: "Remove receipt.pdf" })).toBeVisible();
  await expect(page).toHaveURL(/expenses\/new\?draft=[0-9a-f-]+/);
  await expect(page.locator("body[data-same-page]")).toBeAttached();
  await page.reload();
  await expect(page.getByLabel("What was it for?")).toHaveValue("Printer paper");
  await page.getByRole("button", { name: "Submit expense" }).click();
  await expect(page.getByText("With head of department").first()).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/expenses/new`);
  await page.getByLabel("No receipt available").check();
  await fillExpense(page, "Market soap", "Mama Nkechi, stall 14", "3,000");
  await page.getByLabel("Why is there no receipt?").fill("The market stall gives none");
  await page.getByRole("button", { name: "Submit expense" }).click();
  await expect(page.getByText("With head of department").first()).toBeVisible();
  const soap = page.url();
  await page.goto(`${base}/expenses`);
  await expect(page.getByRole("row", { name: /Market soap/ })).toContainText("No receipt");
  await page.goto(`${base}/reports`);
  await expect(page.getByText("We couldn't find that page").first()).toBeVisible();

  // Head: accept the clean one together, return the other.
  const boss = await (await browser.newContext()).newPage();
  await signIn(boss, head);
  await expect(boss.getByRole("link", { name: /Expenses to review/ })).toContainText("2");
  await boss.goto(`${base}/expenses?tab=inbox`);
  await expect(boss.getByRole("button", { name: "Accept 1 ready" })).toBeVisible();
  await boss.screenshot({
    animations: "disabled",
    path: "test-results/expense-inbox.png",
    fullPage: true,
  });
  await boss.getByRole("button", { name: "Accept 1 ready" }).click();
  await confirm(boss);
  await expect(boss.getByText("1 accepted into the report.").first()).toBeVisible();
  await boss.goto(soap);
  await boss.getByLabel("Decision").selectOption("return");
  await boss.getByLabel("Reason").fill("Say how many bars you bought");
  await boss.getByRole("button", { name: "Return expense" }).click();
  await confirm(boss);
  await expect(boss.getByText("Returned for changes.").first()).toBeVisible();

  // Staff correct it; the head accepts.
  await page.goto(soap);
  await expect(page.getByText("Say how many bars you bought").first()).toBeVisible();
  await page.getByRole("link", { name: "Edit and resubmit" }).click();
  await page.getByLabel("Quantity").fill("4");
  await page.getByRole("button", { name: "Submit expense" }).click();
  await expect(page).toHaveURL(soap);
  await expect(page.getByText("With head of department").first()).toBeVisible();
  await boss.goto(soap);
  await expect(boss.getByRole("button", { name: "Accept expense" })).toBeVisible();
  await boss.screenshot({
    animations: "disabled",
    path: "test-results/expense-decide.png",
    fullPage: true,
  });
  await boss.getByRole("button", { name: "Accept expense" }).click();
  await confirm(boss);
  await expect(boss.getByText("Accepted into the report.").first()).toBeVisible();

  // The report has both, warns about the missing receipt and goes to review.
  await boss.goto(`${base}/reports`);
  await expect(boss.getByRole("link", { name: "Open report" }).first()).toBeVisible();
  await boss.screenshot({
    animations: "disabled",
    path: "test-results/reports.png",
    fullPage: true,
  });
  await boss.getByRole("link", { name: "Open report" }).first().click();
  await expect(boss.getByRole("cell", { name: /Market soap/ })).toBeVisible();
  await expect(boss.getByText("₦24,500.00").first()).toBeVisible();
  await expect(boss.getByText("1 without a receipt. You can still send it.").first()).toBeVisible();
  await boss.screenshot({
    animations: "disabled",
    path: "test-results/report.png",
    fullPage: true,
  });
  await boss.getByLabel("Anything Finance should know? (optional)").fill("Soap prices went up.");
  await boss.getByRole("button", { name: "Send to Finance" }).click();
  await expect(boss.getByRole("alertdialog")).toContainText("1 without a receipt.");
  await confirm(boss);
  await expect(boss.getByText("Under review").first()).toBeVisible();
  await expect(boss.getByRole("button", { name: "Send to Finance" })).toHaveCount(0);
  await expect(boss.getByText("Soap prices went up.").first()).toBeVisible();
  await boss.setViewportSize({ width: 390, height: 844 });
  await boss.screenshot({
    animations: "disabled",
    path: "test-results/report-mobile.png",
    fullPage: true,
  });
  expect(await fits(boss)).toBe(true);
  const report = boss.url();

  // Finance sees it; staff don't, and the receipt is private to those who may see the expense.
  const payer = await (await browser.newContext()).newPage();
  await signIn(payer, finance);
  await expect(payer).toHaveURL(new RegExp(`${base}$`));
  await payer.goto(`${base}/notifications`);
  await payer.getByRole("link", { name: /Halima submitted an expense report/ }).click();
  await expect(payer).toHaveURL(report);
  await expect(payer.getByText(/RPT-/).first()).toBeVisible();
  await page.goto(report);
  await expect(page.getByText("We couldn't find that page").first()).toBeVisible();
  const { data: file } = await admin
    .from("attachments")
    .select("id")
    .eq("org_id", org)
    .eq("kind", "vendor_receipt")
    .single();
  const other = await add("Zainab", [["staff", null]]);
  const colleague = await (await browser.newContext()).newPage();
  await signIn(colleague, other);
  await expect(colleague).toHaveURL(new RegExp(`${base}$`));
  expect((await colleague.request.get(`${base}/files/${file!.id}`)).status()).toBe(404);
  expect((await payer.request.get(`${base}/files/${file!.id}`)).ok()).toBe(true);

  // Two people deciding at once: exactly one decision counts.
  const client = newClient();
  await client.auth.signInWithPassword({ email: staff, password });
  const saved = await client.rpc("save_expense", {
    p_org: org,
    p_id: null,
    p_category: (await admin.from("categories").select("id").eq("org_id", org).single()).data!.id,
    p_department: dept,
    p_request: null,
    p_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()),
    p_description: "Race",
    p_seller: "Seller",
    p_location: null,
    p_phone: null,
    p_funding: "personal",
    p_no_receipt: true,
    p_reason: "None given",
    p_items: [{ description: "Thing", quantity: 1, unit_price_minor: 100 }],
    p_lock: null,
  });
  expect(saved.error).toBeNull();
  await client.rpc("submit_expense", { p_id: saved.data.id, p_lock: 1 });
  const heads = newClient();
  await heads.auth.signInWithPassword({ email: head, password });
  const results = await Promise.all(
    ["accept", "reject", "accept", "return", "accept"].map((p_action) =>
      heads.rpc("decide_expense", {
        p_id: saved.data.id,
        p_lock: 2,
        p_action,
        p_reason: "Because of the race",
      }),
    ),
  );
  expect(results.filter((r) => !r.error)).toHaveLength(1);
});
