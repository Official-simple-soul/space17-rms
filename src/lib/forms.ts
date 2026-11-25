import { z } from "zod";

/** Empty form values become null. Generated RPC types don't mark nullable arguments, so callers cast. */
export const optionalId = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);
