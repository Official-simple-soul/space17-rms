import "server-only";
import { z } from "zod";
import { loadPage, text, type Query } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";

const payload = z
  .object({
    number: z.string().nullish(),
    title: z.string(),
    requester: z.string(),
    actor: z.string().nullish(),
  })
  .partial();

export async function listNotifications(orgId: string, query: Query) {
  const supabase = await createClient();
  return loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_notifications", {
      p_org: orgId,
      p_unread: text(query.show) === "unread",
      ...range,
    });
    if (error) throw new Error("Could not load notifications");
    return data.map((n) => ({ ...n, payload: payload.catch({}).parse(n.payload) }));
  });
}
