import { expect, test, type Page } from "@playwright/test";
import { admin, createOrganisation, enrol, password, signIn } from "./helpers";

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text }).first();

test("every outcome is announced", async ({ page }) => {
  const id = `f${Date.now().toString(36)}`;
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);

  // Failure, invalid fields, and messages carried across a redirect.
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(toast(page, "Check the highlighted fields.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.getByLabel("Email").fill(owner);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(toast(page, "Email or password is incorrect.")).toBeVisible();
  await page.screenshot({ path: "test-results/toast-error.png" });
  await signIn(page, owner);
  await expect(toast(page, "Signed in.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

  // A redirect back to the same page.
  await page.goto("/account");
  await enrol(page);
  await expect(toast(page, "Code verified.")).toBeVisible();

  // A side panel stays open on failure, even when the toast is closed, and closes on success.
  await page.goto(`${base}/departments`);
  await page.getByRole("button", { name: "Add department" }).click();
  const panel = page.getByRole("dialog");
  await panel
    .getByRole("button", { name: /Add|Save|Create/ })
    .last()
    .click();
  await expect(toast(page, "Check the highlighted fields.")).toBeVisible();
  await page.getByRole("button", { name: "Close toast" }).first().click();
  await expect(panel).toBeVisible();
  await page.route("**/departments", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await panel.getByLabel("Name").fill("Logistics");
  await panel.getByLabel(/Code/).fill("LOG");
  await panel
    .getByRole("button", { name: /Add|Save|Create/ })
    .last()
    .click();
  await expect(toast(page, "We couldn't confirm that worked.")).toBeVisible();
  await page.unroute("**/departments");
  await panel
    .getByRole("button", { name: /Add|Save|Create/ })
    .last()
    .click();
  await expect(toast(page, "Logistics added.")).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.screenshot({ path: "test-results/toast-success.png" });

  // An ordinary form, on a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/settings`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast(page, "Organisation details saved.")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/m-toast.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("signing out is announced", async ({ page }) => {
  const email = `bye-${Date.now().toString(36)}@test.local`;
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await signIn(page, email);
  await expect(page).toHaveURL(/no-organisation/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sign out" }).click();
  await expect(toast(page, "You're signed out.")).toBeVisible();
});
