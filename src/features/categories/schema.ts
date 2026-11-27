import { z } from "zod";
import { optionalId } from "@/lib/forms";

/** Categories are labels for grouping spending in reports. */
export const categorySchema = z.object({
  orgId: z.uuid(),
  id: optionalId,
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80),
});
