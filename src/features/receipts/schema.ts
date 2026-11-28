import { z } from "zod";

/** A Cash Purchase Receipt exactly as issued. */
export const internalReceipt = z.object({
  id: z.uuid(),
  org_id: z.uuid(),
  number: z.string(),
  issuer: z.string(),
  currency: z.string(),
  issued_at: z.string(),
  issued_by: z.string(),
  purchase_date: z.string().nullable(),
  description: z.string(),
  seller: z.string(),
  location: z.string().nullable(),
  phone: z.string().nullable(),
  reason: z.string().nullable(),
  department: z.string().nullable(),
  entered_by: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unit_price_minor: z.number(),
      line_total_minor: z.number(),
    }),
  ),
  total_minor: z.number(),
  replaces: z.string().nullable(),
  status: z.enum(["issued", "voided"]),
  verify_token: z.string(),
  voided_at: z.string().nullable(),
  void_reason: z.string().nullable(),
});
export type InternalReceipt = z.infer<typeof internalReceipt>;

/** What the public check page shows. */
export const receiptCheck = z.object({
  number: z.string(),
  issuer: z.string(),
  issued_at: z.string(),
  purchase_date: z.string().nullable(),
  seller: z.string(),
  total_minor: z.number(),
  currency: z.string(),
  status: z.enum(["issued", "voided"]),
  voided_at: z.string().nullable(),
});

export const verifyToken = z.string().regex(/^[0-9a-f]{36}$/);
