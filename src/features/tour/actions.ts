"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Remembers that this person has seen the tour here. Failing only means it may show again. */
export async function finishTour(orgId: string) {
  if (!z.uuid().safeParse(orgId).success) return;
  await (await createClient()).rpc("finish_tour", { p_org: orgId });
}
