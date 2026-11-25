import "server-only";
import { isId } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";
import { templateFields, templateKind, type TemplateKind } from "./schema";

export async function listTemplates(orgId: string, kind?: TemplateKind) {
  let request = (await createClient())
    .from("templates")
    .select("id, kind, name, current_version_id")
    .eq("org_id", orgId)
    .is("archived_at", null)
    .order("name");
  if (kind) request = request.eq("kind", kind);
  const { data, error } = await request;
  if (error) throw new Error("Could not load templates");
  return data;
}

/** Templates with details of their current version. */
export async function listTemplateDetails(orgId: string) {
  const supabase = await createClient();
  const templates = await listTemplates(orgId);
  const ids = templates.flatMap((t) => t.current_version_id ?? []);
  const { data, error } = await supabase
    .from("template_versions")
    .select("id, version, fields, published_at")
    .in("id", ids);
  if (error) throw new Error("Could not load templates");
  const versions = new Map(data.map((v) => [v.id, v]));
  return templates.map((t) => {
    const version = versions.get(t.current_version_id ?? "");
    return {
      id: t.id,
      name: t.name,
      kind: templateKind.parse(t.kind),
      version: version?.version ?? 0,
      fields: Array.isArray(version?.fields) ? version.fields.length : 0,
      publishedAt: version?.published_at ?? "",
    };
  });
}

export async function getTemplate(orgId: string, id: string) {
  if (!isId(id)) return null;
  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("templates")
    .select("id, kind, name, current_version_id")
    .eq("org_id", orgId)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error("Could not load template");
  if (!template) return null;
  const versions = await supabase
    .from("template_versions")
    .select("id, version, fields, published_at")
    .eq("org_id", orgId)
    .eq("template_id", id)
    .order("version", { ascending: false })
    .limit(50);
  if (versions.error) throw new Error("Could not load template");
  const history = versions.data.map((v) => ({
    id: v.id,
    version: v.version,
    fields: templateFields.parse(v.fields),
    publishedAt: v.published_at,
  }));
  const current = history.find((v) => v.id === template.current_version_id);
  if (!current) throw new Error("Template has no published version");
  return {
    id: template.id,
    name: template.name,
    kind: templateKind.parse(template.kind),
    version: current.version,
    fields: current.fields,
    history,
  };
}
