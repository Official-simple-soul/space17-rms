import "server-only";
import { z } from "zod";
import { isId } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";

const file = z.object({ storage_path: z.string(), file_name: z.string(), mime: z.string() });
/** Null unless the caller may see the record the file belongs to. */
export async function getAttachment(id: string) {
  if (!isId(id)) return null;
  const { data, error } = await (
    await createClient()
  )
    .rpc("get_attachment", { p_id: id })
    .maybeSingle();
  return error || !data ? null : file.parse(data);
}
