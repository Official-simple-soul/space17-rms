import "server-only";
import { isDate, parseSort } from "@/lib/data-view";
import { isId, loadPage, text, type Query } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";

const readable = (value: string) => {
  const words = value.replace(/[._]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export async function listAudit(orgId: string, query: Query) {
  const supabase = await createClient();
  const sort = parseSort(text(query.sort));
  const [area, person, from, to] = [query.area, query.person, query.from, query.to].map(text);
  const { rows, server } = await loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_audit", {
      p_org: orgId,
      p_search: text(query.q),
      p_area: area || undefined,
      p_person: isId(person) ? person : undefined,
      p_from: isDate(from) ? from : undefined,
      p_to: isDate(to) ? to : undefined,
      p_sort: sort?.key,
      p_desc: sort?.desc,
      ...range,
    });
    if (error) throw new Error("Could not load audit log");
    return data;
  });
  return {
    server,
    rows: rows.map((e) => ({
      id: e.id,
      action: readable(e.action),
      area: readable(e.area),
      person: e.person,
      reason: e.reason ?? "",
      at: e.at,
      before: e.before,
      after: e.after,
    })),
  };
}

export async function listAuditFilters(orgId: string) {
  const { data, error } = await (await createClient()).rpc("audit_filters", { p_org: orgId });
  if (error) throw new Error("Could not load audit filters");
  const pick = (kind: string) => data.filter((f) => f.kind === kind);
  return {
    areas: pick("area").map((f) => ({ value: f.value, label: readable(f.label) })),
    people: pick("person").map((f) => ({ value: f.value, label: f.label })),
  };
}
