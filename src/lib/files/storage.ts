import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/config/env";
import { isLocalSupabase, LOCAL_STORAGE_PATH } from "./local";
import { contentMatches, MAX_FILE_SIZE } from "./types";

// The bucket has no client access. Callers must authorise with the user's own session first.
const bucket = () => createAdminClient().storage.from("attachments");

const reachable = (url: string) =>
  isLocalSupabase(env.supabaseUrl) ? url.replace(env.supabaseUrl, LOCAL_STORAGE_PATH) : url;

export async function createUploadUrl(path: string) {
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error) throw new Error("Could not prepare upload");
  return reachable(data.signedUrl);
}

/** Reads the stored file itself; nothing the browser said about it is trusted. */
export async function inspectFile(path: string, type: string) {
  const { data, error } = await bucket().download(path);
  if (error) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_FILE_SIZE || !contentMatches(type, bytes)) return null;
  return { size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function deleteFiles(paths: string[]) {
  if (!paths.length) return;
  const { error } = await bucket().remove(paths);
  if (error) console.error("Could not delete stored files", error.message);
}

export async function createDownloadUrl(path: string, name: string, inline: boolean) {
  const { data, error } = await bucket().createSignedUrl(
    path,
    60,
    inline ? {} : { download: name },
  );
  if (error) throw new Error("Could not open file");
  return reachable(data.signedUrl);
}
