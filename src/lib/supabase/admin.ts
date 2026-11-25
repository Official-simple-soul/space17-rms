import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { serverEnv } from "@/config/server-env";
import type { Database } from "./database.types";

/** Bypasses Row Level Security. Use only for account creation and public server operations. */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
