import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/surface";
import { VersionHistory } from "@/features/configuration/components/version-history";
import { ArchiveTemplate, TemplateEditor } from "@/features/templates/components/template-editor";
import { TemplateFields } from "@/features/templates/components/template-fields";
import { getTemplate } from "@/features/templates/repository";
import { TEMPLATE_KINDS } from "@/features/templates/schema";
import { requireConfiguration } from "@/lib/auth/configuration";

export const metadata: Metadata = { title: "Template" };

export default async function TemplatePage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/templates/[templateId]">) {
  const { orgSlug, templateId } = await params;
  const { organisation } = await requireConfiguration(orgSlug);
  const template = await getTemplate(organisation.id, templateId);
  if (!template && templateId !== "new") notFound();
  return (
    <>
      <Link
        href={`/o/${orgSlug}/configuration/templates`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← Templates
      </Link>
      <PageHeader
        title={template?.name ?? "New template"}
        description={
          template
            ? `${TEMPLATE_KINDS[template.kind]} template, version ${template.version}. Items already submitted keep their version.`
            : "Add questions to a request or report form."
        }
      />
      <TemplateEditor
        orgId={organisation.id}
        slug={orgSlug}
        template={
          template
            ? {
                id: template.id,
                name: template.name,
                kind: template.kind,
                version: template.version,
                fields: template.fields,
              }
            : undefined
        }
      />
      {template && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <VersionHistory
            versions={template.history.map((v) => ({
              version: v.version,
              publishedAt: v.publishedAt,
              content: <TemplateFields fields={v.fields} disabled />,
            }))}
          />
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold">Archive</h2>
            <ArchiveTemplate orgId={organisation.id} slug={orgSlug} id={template.id} />
          </Card>
        </div>
      )}
    </>
  );
}
