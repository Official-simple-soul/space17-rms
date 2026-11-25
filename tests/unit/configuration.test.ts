import { describe, expect, it } from "vitest";
import { moveItem } from "@/components/ui/row-controls";
import { exampleNumber } from "@/features/numbering/format";
import { describeWarning } from "@/features/setup/warnings";
import { templateFields } from "@/features/templates/schema";
import { stepsForAmount } from "@/features/workflows/rules";
import { workflowSteps } from "@/features/workflows/schema";
import { isDate } from "@/lib/data-view";
import { parseMoney } from "@/lib/format";

describe("parseMoney", () => {
  it.each([
    ["12,500.50", 1250050],
    ["₦ 100", 10000],
    ["0.1", 10],
    ["1.15", 115],
    ["0", 0],
  ])("reads %s", (text, minor) => expect(parseMoney(text)).toBe(minor));
  it.each(["", "-5", "1,00", "1.234", "abc", "1e3", "99999999999999999"])("refuses %s", (text) =>
    expect(parseMoney(text)).toBeNull(),
  );
});

describe("workflows", () => {
  const step = {
    name: "Approval",
    approver_type: "category_approvers",
    role_id: null,
    membership_id: null,
    min_amount_minor: null as number | null,
    required_approvals: 1,
  };
  it("applies thresholds from their amount upwards", () => {
    const steps = [step, { ...step, min_amount_minor: 5000 }];
    expect(stepsForAmount(steps, 4999)).toHaveLength(1);
    expect(stepsForAmount(steps, 5000)).toHaveLength(2);
  });
  it("needs a step for every amount and a chosen approver", () => {
    expect(workflowSteps.safeParse([step]).success).toBe(true);
    expect(workflowSteps.safeParse([{ ...step, min_amount_minor: 100 }]).success).toBe(false);
    expect(workflowSteps.safeParse([{ ...step, min_amount_minor: 0 }]).success).toBe(false);
    expect(workflowSteps.safeParse([{ ...step, approver_type: "role" }]).success).toBe(false);
  });
});

describe("templates", () => {
  const field = { key: "a", label: "A", type: "short_text", required: false };
  it("drops empty help and stray options", () =>
    expect(templateFields.parse([{ ...field, help: " ", options: ["x", "y"] }])).toEqual([field]));
  it("needs dropdown options and unique keys", () => {
    expect(templateFields.safeParse([{ ...field, type: "dropdown" }]).success).toBe(false);
    expect(
      templateFields.safeParse([{ ...field, type: "dropdown", options: ["x", "x"] }]).success,
    ).toBe(false);
    expect(templateFields.safeParse([field, field]).success).toBe(false);
  });
});

it("shows example numbers", () => {
  const today = "2026-11-25";
  expect(exampleNumber({ prefix: "req", reset: "year", digits: 4 }, today)).toBe("REQ-2026-0001");
  expect(exampleNumber({ prefix: "PAY", reset: "month", digits: 3 }, today)).toBe("PAY-202611-001");
  expect(exampleNumber({ prefix: "RPT", reset: "never", digits: 5 }, today)).toBe("RPT-00001");
});

it("moves items without leaving the list", () => {
  expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
});

it("accepts only real dates", () => {
  expect(isDate("2026-02-28")).toBe(true);
  for (const bad of ["2026-02-30", "26-01-01", "", undefined, ["2026-01-01"]])
    expect(isDate(bad)).toBe(false);
});

it("links a warning to its fix", () =>
  expect(
    describeWarning(
      { code: "category_approvers", subject_id: "c1", subject: "Travel", found: 1, needed: 2 },
      "/o/acme",
    ),
  ).toEqual({
    text: "Travel: 1 person can approve, 2 needed so requests never get stuck.",
    href: "/o/acme/configuration/categories/c1",
  }));
