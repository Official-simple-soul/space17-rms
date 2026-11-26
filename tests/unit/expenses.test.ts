import { describe, expect, it } from "vitest";
import { checkExpense, type ExpenseForm } from "@/features/expenses/form";
import { summarise } from "@/features/reports/summary";
import { formatMonth } from "@/lib/format";

const form: ExpenseForm = {
  description: "Soap",
  date: "2026-11-20",
  categoryId: "c",
  departmentId: "d",
  seller: "Mama Nkechi",
  phone: "",
  noReceipt: false,
  reason: "",
  items: [{ key: "a", description: "Soap", quantity: "2", price: "500" }],
  receipts: 1,
};
const check = (changes: Partial<ExpenseForm>) =>
  checkExpense({ ...form, ...changes }, "2026-11-25");

describe("checkExpense", () => {
  it("accepts a complete expense, with or without a receipt", () => {
    expect(check({})).toBeNull();
    expect(check({ noReceipt: true, receipts: 0, reason: "Market stall" })).toBeNull();
  });
  it("needs a receipt or a reason, not both", () => {
    expect(check({ receipts: 0 })?.receipt).toBeTruthy();
    expect(check({ noReceipt: true, receipts: 0 })?.reason).toBeTruthy();
    expect(check({ noReceipt: true, reason: "Market stall" })?.receipt).toBeTruthy();
  });
  it("checks the date, phone and items", () => {
    expect(check({ date: "2026-11-26" })?.date).toBeTruthy();
    expect(check({ date: "2025-11-01" })?.date).toBeTruthy();
    expect(check({ date: "2026-02-30" })?.date).toBeTruthy();
    expect(check({ phone: "call me" })?.phone).toBeTruthy();
    expect(check({ phone: "+234 803 000 0000" })).toBeNull();
    expect(check({ items: [] })?.list).toBeTruthy();
  });
});

it("summarises a report by category and evidence", () => {
  const line = { total_minor: 100, category: "Travel", evidence: "vendor_receipt" as const };
  const result = summarise([
    line,
    { ...line, total_minor: 300, evidence: "missing" },
    { ...line, category: "Office", total_minor: 50 },
  ]);
  expect(result.total).toBe(450);
  expect(result.missing).toBe(1);
  expect(result.coverage).toBe(66);
  expect(result.categories).toEqual([
    { name: "Travel", total: 400 },
    { name: "Office", total: 50 },
  ]);
  expect(summarise([]).coverage).toBe(100);
});

it("shows months the same in every timezone", () =>
  expect(formatMonth("2026-11-01")).toBe("November 2026"));
