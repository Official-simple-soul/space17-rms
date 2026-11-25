export const DOCUMENTS = {
  request: "Requests",
  report: "Reports",
  payment: "Payments",
  internal_receipt: "Cash Purchase Receipts",
} as const;
export type DocumentType = keyof typeof DOCUMENTS;
export const RESETS = {
  year: "Every year",
  month: "Every month",
  never: "Never",
} as const;
export type Reset = keyof typeof RESETS;

/** Example only. The database issues the real numbers. */
export function exampleNumber(
  { prefix, reset, digits }: { prefix: string; reset: string; digits: number },
  today: string,
) {
  const period =
    reset === "year"
      ? today.slice(0, 4)
      : reset === "month"
        ? today.slice(0, 7).replace("-", "")
        : "";
  return [prefix.toUpperCase(), period, "1".padStart(digits, "0")].filter(Boolean).join("-");
}
