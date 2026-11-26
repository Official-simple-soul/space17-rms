import { describe, expect, it } from "vitest";
import { checkDraft } from "@/features/requests/form";
import { fromAnswers, toAnswers } from "@/features/templates/answers";
import { lineTotal, parseQuantity } from "@/lib/line-items";
import { notificationMessage } from "@/features/notifications/message";
import type { TemplateField } from "@/features/templates/schema";
import { contentMatches } from "@/lib/files/types";

const fields: TemplateField[] = [
  { key: "cost", label: "Cost", type: "money", required: true },
  { key: "days", label: "Days", type: "number", required: false },
  { key: "agree", label: "Agree", type: "checkbox", required: true },
  { key: "mode", label: "Mode", type: "dropdown", required: false, options: ["Road", "Air"] },
  { key: "quote", label: "Quote", type: "file", required: true },
];
const valid = {
  title: "Printer paper",
  purpose: "For the office",
  categoryId: "c",
  departmentId: "d",
  items: [{ key: "i", description: "Paper", quantity: "2.5", price: "500" }],
  fields,
  answers: { cost: "12,500.50", agree: true },
  files: ["quote"] as (string | null)[],
};

describe("request drafts", () => {
  it("reads quantities and totals like the database", () => {
    expect(parseQuantity("1,000.125")).toBe(1000.125);
    for (const bad of ["", "-1", "1.2345", "x"]) expect(parseQuantity(bad)).toBeNull();
    expect(lineTotal({ quantity: "2.5", price: "500" })).toBe(125000);
    expect(lineTotal({ quantity: "0.333", price: "1.00" })).toBe(33);
    expect(lineTotal({ quantity: "0.005", price: "1.00" })).toBe(1);
    expect(lineTotal({ quantity: "x", price: "1" })).toBe(0);
  });
  it("converts answers without losing what can't be read", () => {
    const data = fromAnswers(fields, { cost: "12,500.50", days: "soon", agree: true, junk: "x" });
    expect(data).toEqual({ cost: 1250050, days: "soon", agree: true });
    expect(toAnswers(fields, data)).toEqual({ cost: "12500.50", days: "soon", agree: true });
  });
  it("accepts a complete draft", () => expect(checkDraft(valid)).toBeNull());
  it("points at each problem", () => {
    const errors = checkDraft({
      ...valid,
      title: "",
      departmentId: "",
      items: [{ key: "i", description: "Paper", quantity: "0", price: "500" }],
      answers: { cost: "lots", agree: false, mode: "Boat", days: "x" },
      files: [null],
    });
    expect(errors?.title).toBeTruthy();
    expect(errors?.department).toBeTruthy();
    expect(errors?.items.i).toBeTruthy();
    expect(Object.keys(errors!.answers).sort()).toEqual(["agree", "cost", "days", "mode", "quote"]);
  });
});

it("recognises files by content, not name", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);
  expect(contentMatches("application/pdf", bytes("%PDF-1.7"))).toBe(true);
  expect(contentMatches("application/pdf", bytes("<html>"))).toBe(false);
  expect(contentMatches("image/png", bytes("%PDF-1.7"))).toBe(false);
  expect(contentMatches("text/html", bytes("PK\u0003\u0004"))).toBe(false);
});

it("words notifications", () =>
  expect(
    notificationMessage("request_returned", { number: "REQ-1", title: "Paper", actor: "Ada" }),
  ).toBe("Ada returned your request: REQ-1 Paper"));
