import { z } from "zod";
import { FILE_TYPES, isFileType, MAX_FILE_SIZE } from "@/lib/files/types";

export const attachment = z.object({
  id: z.uuid(),
  name: z.string(),
  mime: z.string(),
  size: z.number(),
  field_key: z.string().nullable(),
});
export type Attachment = z.infer<typeof attachment>;

export const uploadInput = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().refine(isFileType),
  size: z.number().int().min(1).max(MAX_FILE_SIZE),
});
export type UploadInput = z.input<typeof uploadInput>;
export type UploadStart = { ok: true; id: string; url: string } | { ok: false; message: string };

export const badFile: UploadStart = {
  ok: false,
  message: `Use ${[...new Set(Object.values(FILE_TYPES))].join(", ")} files up to 10 MB.`,
};
