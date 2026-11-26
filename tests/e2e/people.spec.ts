import { expect, test } from "@playwright/test";
import { confirm, createOrganisation, enrol, password, signIn } from "./helpers";

test("admin organises departments, roles and people", async ({ page, browser }) => {
  const id = `p${Date.now().toString(36)}`;
  const owner = `boss-${id}@test.local`;
  const base = await createOrganisation(id, owner);
  await signIn(page, owner);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await page.goto("/account");
  await enrol(page);
  await expect(page.getByText("Two-step verification is on.").first()).toBeVisible();

  await page.goto(`${base}/departments`);
  for (const [name, code] of [
    ["Finance", "FIN"],
    ["Operations", "OPS"],
  ]) {
    await page.getByRole("button", { name: "Add department" }).click();
    const panel = page.getByRole("dialog");
    await panel.getByLabel("Name", { exact: true }).fill(name);
    await panel.getByLabel("Code").fill(code);
    await panel.getByRole("button", { name: "Add department" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("row", { name: new RegExp(`${name} ${code}`) })).toBeVisible();
  }

  await page.goto(`${base}/members`);
  await page.getByRole("button", { name: "Invite person" }).click();
  await page.getByLabel("Email").fill(`head-${id}@test.local`);
  await page.getByLabel("Role", { exact: true }).selectOption({ label: "Head of department" });
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByText("Choose a department for this role.").first()).toBeVisible();
  await page.getByLabel("Department", { exact: true }).selectOption({ label: "Finance" });
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = (await page.getByTestId("join-links").textContent())!;

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Import" }).click();
  await page.getByLabel("One person per line").fill(`bad,Staff\nx-${id}@test.local,Wizard`);
  await page.getByRole("button", { name: "Check and invite" }).click();
  await expect(page.getByText("No one was invited.").first()).toBeVisible();
  await page
    .getByLabel("One person per line")
    .fill(`email,role,department\nstaff-${id}@test.local,Staff,OPS`);
  await page.getByRole("button", { name: "Check and invite" }).click();
  await expect(page.getByText("1 of 1 invited.").first()).toBeVisible();

  const head = await (await browser.newContext()).newPage();
  await head.goto(link);
  await head.getByLabel("Full name").fill("Henry Head");
  await head.getByLabel("Password", { exact: true }).fill(password);
  await head.getByRole("button", { name: "Create account and join" }).click();
  await expect(head.getByRole("heading", { name: "Hello, Henry" })).toBeVisible();
  for (const path of ["members", "departments", "roles"]) {
    await head.goto(`${base}/${path}`);
    await expect(head.getByText("We couldn't find that page").first()).toBeVisible();
    await expect(head.getByText("Ada Owner")).toHaveCount(0);
  }
  await expect(head.getByText("New role")).toHaveCount(0);

  await page.goto(`${base}/departments`);
  await expect(page.getByRole("row", { name: /Finance.*Henry Head/ })).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/departments.png" });
  await page.getByRole("link", { name: "1 person" }).click();
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Henry Head/ })).toBeVisible();
  await expect(page.locator("main").getByText("Ada Owner")).toHaveCount(0);
  await page.getByLabel("Filter by department").selectOption("");
  await expect(page.getByRole("row", { name: /Ada Owner/ })).toBeVisible();
  await page.getByRole("button", { name: "Name" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Ada Owner");
  await page.getByRole("button", { name: "Name" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Henry Head");
  await page.screenshot({ animations: "disabled", path: "test-results/people.png" });
  await page.getByRole("searchbox").fill("nobody");
  await expect(page.getByText("No matches").first()).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Grid view" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Henry Head/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Grid view" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({ animations: "disabled", path: "test-results/people-grid.png" });
  await page.getByRole("button", { name: "List view" }).click();
  await page.getByRole("link", { name: /Invitations/ }).click();
  await expect(page.getByRole("row", { name: /staff-/ })).toBeVisible();

  await page.goto(`${base}/roles/new`);
  await page.getByLabel("Role name").fill("Report reader");
  await page.getByLabel("View reports").selectOption({ label: "Whole organisation" });
  await page.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByRole("heading", { name: "Report reader" })).toBeVisible();
  await page.getByLabel("Submit reports").selectOption({ label: "Their department" });
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByText("not both").first()).toBeVisible();
  await page.screenshot({ animations: "disabled", path: "test-results/role.png" });

  await page.goto(`${base}/members`);
  await page.getByRole("link", { name: /Henry Head/ }).click();
  await page.getByLabel("Operations").check();
  await page.getByRole("button", { name: "Save departments" }).click();
  await expect(page.getByText("Departments saved.").first()).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/member.png",
    fullPage: true,
  });
  await page.getByLabel("Reason to suspend").fill("On leave");
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
  await head.goto(base);
  await expect(head.getByRole("heading", { name: /Your access to .* is suspended/ })).toBeVisible();
  await page.getByLabel("Reason to remove").fill("Left the company");
  await page.getByRole("button", { name: "Remove from organisation" }).click();
  await confirm(page);
  await expect(page).toHaveURL(new RegExp(`${base}/members$`));
  await expect(page.getByRole("row", { name: /Ada Owner.*Organisation admin/ })).toBeVisible();
  await expect(page.getByText("Henry Head")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["members", "departments", "roles"]) {
    await page.goto(`${base}/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto(`${base}/members`);
  await expect(page.getByRole("table")).toBeVisible();
  for (const select of await page.locator("main select:visible").all())
    expect((await select.boundingBox())!.width).toBeGreaterThan(100);
  await page.screenshot({ animations: "disabled", path: "test-results/mobile-people.png" });
});
