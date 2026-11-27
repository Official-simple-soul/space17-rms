import { expect, test } from "@playwright/test";
import { admin, createOrganisation, password, signIn } from "./helpers";

test("a new member is shown around once, and can replay it", async ({ page }) => {
  const id = `t${Date.now().toString(36)}`;
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);
  const org = (await admin.from("organisations").select("id").eq("slug", `acme-${id}`).single())
    .data!.id as string;
  await admin.from("memberships").update({ tour_completed_at: null }).eq("org_id", org);

  await signIn(page, owner);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading", { name: `Welcome to Acme ${id}` })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/tour-welcome.png" });
  await tour.getByRole("button", { name: "Show me" }).click();
  await expect(tour.getByRole("heading", { name: "Ask for something" })).toBeVisible();
  await expect(page.locator('[data-spot="ask"]')).toBeVisible();
  await expect(tour.getByRole("button", { name: "Next" })).toBeFocused();
  await page.screenshot({ animations: "disabled", path: "test-results/tour-ask.png" });
  await page.keyboard.press("ArrowRight");
  await expect(tour.getByRole("heading", { name: "Your requests" })).toBeVisible();
  await expect(page.locator('[data-spot="nav-requests"]')).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/tour-nav.png" });
  await tour.getByRole("button", { name: "Back" }).click();
  await expect(tour.getByRole("heading", { name: "Ask for something" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);

  // Remembered, so it doesn't open again; the button replays it.
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("memberships")
        .select("tour_completed_at")
        .eq("org_id", org)
        .single();
      return data?.tour_completed_at !== null;
    })
    .toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hello, Ada" })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(tour).toHaveCount(0);
  await page.getByRole("button", { name: "Take the tour" }).click();
  for (let i = 0; i < 20; i++) {
    // Waits for the card to be shown, then reads which button it offers.
    const button = tour.getByRole("button", { name: /^(Show me|Next|Done)$/ });
    if ((await button.textContent()) === "Done") break;
    await button.click();
  }
  await expect(tour.getByRole("heading", { name: "You're all set" })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/tour-done.png" });
  await tour.getByRole("button", { name: "Done" }).click();
  await expect(tour).toHaveCount(0);

  // On a phone the card docks at the edge.
  await admin.from("memberships").update({ tour_completed_at: null }).eq("org_id", org);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await tour.getByRole("button", { name: "Show me" }).click();
  await expect(tour.getByRole("heading", { name: "Ask for something" })).toBeVisible();
  await expect(page.locator('[data-spot="ask"]')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ animations: "disabled", path: "test-results/m-tour.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  void password;
});
