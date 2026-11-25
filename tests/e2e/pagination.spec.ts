import { expect, test } from "@playwright/test";
import { admin, createOrganisation, signIn } from "./helpers";

test("people are paged, searched and sorted by the server", async ({ page }) => {
  const id = `g${Date.now().toString(36)}`;
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);
  const { data: org, error } = await admin
    .from("organisations")
    .select("id")
    .eq("slug", `acme-${id}`)
    .single();
  if (error) throw error;
  for (let n = 1; n <= 44; n++) {
    const user = await admin.auth.admin.createUser({
      email: `p${n}-${id}@test.local`,
      email_confirm: true,
      user_metadata: { full_name: `Person ${String(n).padStart(2, "0")}` },
    });
    if (user.error) throw user.error;
    const added = await admin
      .from("memberships")
      .insert({ org_id: org.id, user_id: user.data.user.id });
    if (added.error) throw added.error;
  }
  await signIn(page, owner);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto(`${base}/members`);
  const rows = page.locator("tbody tr");
  await expect(page.getByText("1–20 of 45")).toBeVisible();
  await expect(rows).toHaveCount(20);
  await expect(page.getByText("45 people across")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("21–40 of 45")).toBeVisible();
  await page.screenshot({ path: "test-results/people-paged.png", fullPage: true });
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("41–45 of 45")).toBeVisible();
  await expect(rows).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await page.reload();
  await expect(page.getByText("41–45 of 45")).toBeVisible();

  // A search looks through everyone, not just the page on screen, and restarts at page one.
  await page.getByRole("searchbox").pressSequentially("person 03", { delay: 40 });
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await expect(rows).toContainText("Person 03");
  await expect(page.getByRole("searchbox")).toHaveValue("person 03");
  await page.getByRole("searchbox").fill("nobody");
  await expect(page.getByText("No matches")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("1–20 of 45")).toBeVisible();
  await page.getByLabel("Sort").selectOption("-name");
  await expect(rows.first()).toContainText("Person 44");
  await page.getByRole("searchbox").fill("person");
  await expect(page.getByText("1–20 of 44")).toBeVisible();
  await page.getByRole("link", { name: "People", exact: true }).first().click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.getByText("1–20 of 45")).toBeVisible();
  // Changes made in quick succession are all kept.
  await page.getByLabel("Sort").selectOption("-name");
  await page.getByLabel("Filter by status").selectOption("active");
  await page.getByLabel("Filter by role").selectOption({ label: "Organisation admin" });
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await expect(page).toHaveURL(/sort=-name&status=active&role=/);
  await page.goto(`${base}/members?page=99`);
  await expect(page.getByText("1–20 of 45")).toBeVisible();
});
