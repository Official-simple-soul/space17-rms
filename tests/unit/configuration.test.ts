import { describe, expect, it } from "vitest";
import { exampleNumber } from "@/features/numbering/format";
import { describeWarning } from "@/features/setup/warnings";
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

it("shows example numbers", () => {
  const today = "2026-11-25";
  expect(exampleNumber({ prefix: "req", reset: "year", digits: 4 }, today)).toBe("REQ-2026-0001");
  expect(exampleNumber({ prefix: "PAY", reset: "month", digits: 3 }, today)).toBe("PAY-202611-001");
  expect(exampleNumber({ prefix: "RPT", reset: "never", digits: 5 }, today)).toBe("RPT-00001");
});

it("accepts only real dates", () => {
  expect(isDate("2026-02-28")).toBe(true);
  for (const bad of ["2026-02-30", "26-01-01", "", undefined, ["2026-01-01"]])
    expect(isDate(bad)).toBe(false);
});

describe("setup warnings", () => {
  const warning = { code: "department_approvers", subject_id: "d1", subject: "Kitchen", needed: 2 };
  it("says when nobody can approve", () =>
    expect(describeWarning({ ...warning, found: 0 }, "/o/acme")).toEqual({
      text: "No one can approve requests for Kitchen. Choose a head for it.",
      href: "/o/acme/members",
    }));
  it("explains why one approver is not enough", () =>
    expect(describeWarning({ ...warning, found: 1 }, "/o/acme").text).toMatch(/own requests/));
});
