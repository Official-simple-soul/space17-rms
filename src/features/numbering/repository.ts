import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS, type DocumentType, type Reset } from "./format";

const row = z.object({
  document_type: z.enum(["request", "report", "payment", "internal_receipt"]),
  prefix: z.string(),
  reset: z.enum(["year", "month", "never"]),
  digits: z.number(),
});

export async function listNumbering(
  orgId: string,
): Promise<{ type: DocumentType; prefix: string; reset: Reset; digits: number }[]> {
  const { data, error } = await (
    await createClient()
  )
    .from("number_sequences")
    .select("document_type, prefix, reset, digits")
    .eq("org_id", orgId);
  if (error) throw new Error("Could not load numbering");
  const order = Object.keys(DOCUMENTS);
  return z
    .array(row)
    .parse(data)
    .map(({ document_type, ...r }) => ({ type: document_type, ...r }))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}
