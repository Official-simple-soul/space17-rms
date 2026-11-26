"use server";

import { z } from "zod";
import { failure } from "@/lib/action-state";
import { deleteFiles, inspectFile } from "@/lib/files/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function finishUpload(
  id: string,
): Promise<{ ok: true; size: number } | { ok: false; message: string }> {
  const failed = { ok: false as const, message: "That file couldn't be read. Try another." };
  if (!z.uuid().safeParse(id).success) return failed;
  // The caller's session proves the upload is theirs before the server touches storage.
  const { data: pending } = await (
    await createClient()
  )
    .rpc("get_pending_attachment", { p_id: id })
    .maybeSingle();
  if (!pending) return failed;
  const file = await inspectFile(pending.storage_path, pending.mime);
  const admin = createAdminClient();
  const { error } = file
    ? await admin.rpc("finish_attachment", {
        p_id: id,
        p_size: file.size,
        p_sha256: file.sha256,
      })
    : { error: null };
  if (file && !error) return { ok: true, size: file.size };
  await deleteFiles([pending.storage_path]);
  await admin.rpc("discard_attachment", { p_id: id });
  return error ? { ok: false, message: failure(error).message! } : failed;
}

export async function removeUpload(id: string): Promise<{ ok: boolean; message?: string }> {
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const { data, error } = await (await createClient()).rpc("remove_attachment", { p_id: id });
  if (error) return { ok: false, message: failure(error).message };
  if (data) await deleteFiles([data]);
  return { ok: true };
}
