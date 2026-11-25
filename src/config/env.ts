import { z } from "zod";

const schema = z.object({
  appUrl: z.url(),
  supabaseUrl: z.url(),
  supabaseKey: z.string().min(1),
});

/** Public values must be referenced by full name so Next.js can inline them. */
export const env = schema.parse({
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
