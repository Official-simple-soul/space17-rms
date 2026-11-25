"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";

export async function addStarterConfiguration(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const input = z.object({ orgId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  const { error } = await (
    await createClient()
  ).rpc("add_starter_configuration", { p_org: input.data.orgId });
  if (error) return failure(error);
  revalidatePath("/o/[orgSlug]", "layout");
  return { ok: true, message: "Starter set added." };
}
