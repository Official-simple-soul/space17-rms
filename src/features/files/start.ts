import "server-only";
import { z } from "zod";
import { failure } from "@/lib/action-state";
import { createUploadUrl } from "@/lib/files/storage";
import type { UploadStart } from "./schema";

/** Turns a database permission to upload into a signed link. */
export async function uploadLink(result: {
  data: unknown;
  error: { message: string; code?: string } | null;
}): Promise<UploadStart> {
  if (result.error) return { ok: false, message: failure(result.error).message! };
  const { id, path } = z.object({ id: z.uuid(), path: z.string() }).parse(result.data);
  return { ok: true, id, url: await createUploadUrl(path) };
}
