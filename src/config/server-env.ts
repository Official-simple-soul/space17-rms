import "server-only";
import { z } from "zod";

export function serverEnv() {
  return z
    .object({ SUPABASE_SECRET_KEY: z.string().min(1) })
    .parse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
}
