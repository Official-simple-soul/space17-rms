import { describe, expect, it } from "vitest";
import { checkDraft } from "@/features/requests/form";
import { lineTotal, parseQuantity } from "@/lib/line-items";
import { notificationMessage } from "@/features/notifications/message";
import { contentMatches } from "@/lib/files/types";

const valid = {
  title: "Rice",
  purpose: "For the kitchen",
  provision: "money" as const,
  departmentId: "d",
  items: [{ key: "single", description: "Rice", quantity: "1", price: "25,000" }],
  itemised: false,
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
  it("accepts a complete draft", () => expect(checkDraft(valid)).toBeNull());
  it("points at each problem in plain words", () => {
    const errors = checkDraft({
      ...valid,
      title: "",
      purpose: " ",
      provision: "",
      departmentId: "",
      items: [],
    });
    expect(errors).toMatchObject({
      title: "Say what you need.",
      purpose: "Say why you need it.",
      provision: "Choose how you'd like it.",
      department: "Choose a department.",
      amount: "Enter how much it will cost.",
    });
  });
  it("needs no amount for a provided item", () =>
    expect(checkDraft({ ...valid, provision: "provide", items: [] })).toBeNull());
  it("checks each item when listed separately", () => {
    const items = [{ key: "i", description: "Rice", quantity: "0", price: "500" }];
    expect(checkDraft({ ...valid, itemised: true, items })?.items.i).toBeTruthy();
    expect(checkDraft({ ...valid, itemised: true, items: [] })?.amount).toBe(
      "Add at least one item.",
    );
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
