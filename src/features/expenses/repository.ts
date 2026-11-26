import "server-only";
import { isDate, parseSort } from "@/lib/data-view";
import { isId, loadPage, text, type Query } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";
import { EVIDENCE, evidence, expenseDetail, expenseFlags, expenseStatus, funding } from "./schema";

export type ExpenseView = "mine" | "inbox" | "all";

export async function listExpenses(orgId: string, view: ExpenseView, query: Query) {
  const supabase = await createClient();
  const sort = parseSort(text(query.sort));
  const [category, department, from, to] = [
    query.category,
    query.department,
    query.from,
    query.to,
  ].map(text);
  const { rows, server } = await loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_expenses", {
      p_org: orgId,
      p_view: view,
      p_search: text(query.q),
      p_status: expenseStatus.safeParse(text(query.status)).data,
      p_category: isId(category) ? category : undefined,
      p_department: isId(department) ? department : undefined,
      p_evidence: evidence.safeParse(text(query.evidence)).data,
      p_from: isDate(from) ? from : undefined,
      p_to: isDate(to) ? to : undefined,
      p_sort: sort?.key,
      p_desc: sort?.desc,
      ...range,
    });
    if (error) throw new Error("Could not load expenses");
    return data;
  });
  return {
    server,
    rows: rows.map((r) => ({
      id: r.id,
      description: r.description || "Untitled expense",
      seller: r.seller,
      by: r.entered_by,
      category: r.category,
      department: r.department,
      date: r.expense_date ?? "",
      amount: r.total_minor,
      funding: funding.parse(r.funding),
      status: expenseStatus.parse(r.status),
      flags: expenseFlags.parse(r.flags),
      evidence: evidence.parse(r.evidence) satisfies keyof typeof EVIDENCE,
    })),
  };
}

export async function getExpense(orgId: string, id: string) {
  if (!isId(id)) return null;
  const { data, error } = await (await createClient()).rpc("get_expense", { p_id: id });
  if (error?.message === "not_found") return null;
  if (error) throw new Error("Could not load expense");
  const expense = expenseDetail.parse(data);
  return expense.org_id === orgId ? expense : null;
}

export async function listExpenseCategories(orgId: string) {
  const { data, error } = await (await createClient()).rpc("expense_categories", { p_org: orgId });
  if (error) throw new Error("Could not load categories");
  return data;
}

export async function listLinkableRequests(orgId: string) {
  const { data, error } = await (await createClient()).rpc("linkable_requests", { p_org: orgId });
  if (error) throw new Error("Could not load requests");
  return data;
}

/** Submitted lines with a receipt and no flags, which a head may accept together. */
export async function listReadyExpenses(orgId: string) {
  const { data, error } = await (await createClient()).rpc("ready_expenses", { p_org: orgId });
  if (error) throw new Error("Could not load expenses");
  return data;
}

export async function listRequestExpenses(requestId: string) {
  const { data, error } = await (
    await createClient()
  ).rpc("request_expenses", { p_request: requestId });
  if (error) throw new Error("Could not load expenses");
  return data.map((e) => ({ ...e, status: expenseStatus.parse(e.status) }));
}
