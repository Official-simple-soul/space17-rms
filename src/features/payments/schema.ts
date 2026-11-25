import { z } from "zod";

export const METHODS = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
} as const;
export type PaymentMethod = keyof typeof METHODS;
export const paymentMethod = z.enum(["bank_transfer", "cash", "cheque", "card", "other"]);
