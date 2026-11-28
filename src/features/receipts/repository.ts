import "server-only";
import { isId } from "@/lib/server-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { internalReceipt, receiptCheck, verifyToken } from "./schema";

export async function getInternalReceipt(id: string) {
  if (!isId(id)) return null;
  const { data, error } = await (await createClient()).rpc("get_internal_receipt", { p_id: id });
  if (error) return null;
  return internalReceipt.parse(data);
}

/** The public check behind the QR code. Runs on the server, which only reveals the agreed details. */
export async function checkReceipt(token: string) {
  if (!verifyToken.safeParse(token).success) return null;
  const { data, error } = await createAdminClient().rpc("verify_internal_receipt", {
    p_token: token,
  });
  if (error || !data) return null;
  return receiptCheck.parse(data);
}
