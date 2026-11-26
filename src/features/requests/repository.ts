import "server-only";
import { cache } from "react";
import { parseSort } from "@/lib/data-view";
import { isId, loadPage, text, type Query } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";
import { requestDetail, requestStatus } from "./schema";

export type RequestView = "mine" | "all" | "inbox";

export async function listRequests(orgId: string, view: RequestView, query: Query) {
  const supabase = await createClient();
  const sort = parseSort(text(query.sort));
  const status = requestStatus.safeParse(text(query.status));
  const [category, department] = [text(query.category), text(query.department)];
  const { rows, server } = await loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_requests", {
      p_org: orgId,
      p_view: view,
      p_search: text(query.q),
      p_status: status.data,
      p_category: isId(category) ? category : undefined,
      p_department: isId(department) ? department : undefined,
      p_sort: sort?.key,
      p_desc: sort?.desc,
      ...range,
    });
    if (error) throw new Error("Could not load requests");
    return data;
  });
  return {
    server,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number ?? "",
      title: r.title || "Untitled request",
      requester: r.requester,
      category: r.category,
      department: r.department,
      status: requestStatus.parse(r.status),
      amount: r.approved_minor ?? r.total_minor,
      waitingSince: r.waiting_since ?? "",
      date: r.submitted_at ?? r.updated_at,
    })),
  };
}

export async function getRequest(orgId: string, id: string) {
  if (!isId(id)) return null;
  const { data, error } = await (await createClient()).rpc("get_request", { p_id: id });
  if (error?.message === "not_found") return null;
  if (error) throw new Error("Could not load request");
  const request = requestDetail.parse(data);
  return request.org_id === orgId ? request : null;
}

export async function listRequestableCategories(orgId: string) {
  const { data, error } = await (
    await createClient()
  ).rpc("requestable_categories", { p_org: orgId });
  if (error) throw new Error("Could not load categories");
  return data;
}

export async function previewSteps(categoryId: string, total: number) {
  const { data, error } = await (
    await createClient()
  ).rpc("preview_steps", { p_category: categoryId, p_total: total });
  return error ? [] : data;
}

export const getMyWork = cache(async (orgId: string) => {
  const { data, error } = await (await createClient()).rpc("my_work", { p_org: orgId }).single();
  if (error) throw new Error("Could not load your work");
  return data;
});
