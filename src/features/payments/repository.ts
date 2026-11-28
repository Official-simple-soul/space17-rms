import "server-only";
import { isDate, parseSort } from "@/lib/data-view";
import { isId, loadPage, text, type Query } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";
import { paymentMethod } from "./schema";

export async function listPayable(orgId: string, query: Query) {
  const supabase = await createClient();
  const sort = parseSort(text(query.sort));
  const department = text(query.department);
  const { rows, server } = await loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_payable", {
      p_org: orgId,
      p_search: text(query.q),
      p_department: isId(department) ? department : undefined,
      p_sort: sort?.key,
      p_desc: sort?.desc,
      ...range,
    });
    if (error) throw new Error("Could not load payments");
    return data;
  });
  return {
    server,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      requester: r.requester,
      department: r.department,
      approved: r.approved_minor,
      balance: r.approved_minor - r.paid_minor,
      neededBy: r.needed_by ?? "",
      approvedAt: r.decided_at,
      isOwn: r.is_own,
    })),
  };
}

export async function listPayments(orgId: string, query: Query) {
  const supabase = await createClient();
  const sort = parseSort(text(query.sort));
  const [status, from, to] = [query.status, query.from, query.to].map(text);
  const { rows, server } = await loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_payments", {
      p_org: orgId,
      p_search: text(query.q),
      p_status: ["recorded", "voided"].includes(status) ? status : undefined,
      p_method: paymentMethod.safeParse(text(query.method)).data,
      p_from: isDate(from) ? from : undefined,
      p_to: isDate(to) ? to : undefined,
      p_sort: sort?.key,
      p_desc: sort?.desc,
      ...range,
    });
    if (error) throw new Error("Could not load payments");
    return data;
  });
  return {
    server,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      // A payment is for a request, or repays an expense.
      href: r.request_id ? `requests/${r.request_id}` : `expenses/${r.expense_id}`,
      request: r.request_id ? `${r.request_number} ${r.title}` : `Repaid: ${r.title}`,
      payee: r.payee,
      amount: r.amount_minor,
      paidOn: r.paid_on,
      method: paymentMethod.parse(r.method),
      state: r.status === "voided" ? "Voided" : r.confirmed ? "Confirmed" : "Not confirmed",
    })),
  };
}

export async function listRepayable(orgId: string, query: Query) {
  const supabase = await createClient();
  const department = text(query.department);
  const { rows, server } = await loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_repayable", {
      p_org: orgId,
      p_search: text(query.q),
      p_department: isId(department) ? department : undefined,
      ...range,
    });
    if (error) throw new Error("Could not load repayments");
    return data;
  });
  return {
    server,
    rows: rows.map((r) => ({
      id: r.id,
      description: r.description,
      payee: r.payee,
      department: r.department,
      total: r.total_minor,
      balance: r.total_minor - r.repaid_minor,
      date: r.expense_date,
      isOwn: r.is_own,
    })),
  };
}

/** The masked bank details of the person to repay, for those who may repay them. */
export async function getRepaymentAccount(lineId: string) {
  const { data, error } = await (await createClient()).rpc("repayment_account", { p_line: lineId });
  return error ? null : (data[0] ?? null);
}
