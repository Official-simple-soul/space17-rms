import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { ArchiveCategory, CategoryForm } from "@/features/categories/components/category-form";
import { getCategory } from "@/features/categories/repository";
import { listDepartments } from "@/features/departments/repository";
import { listRoles } from "@/features/roles/repository";
import { listSetupWarnings } from "@/features/setup/repository";
import { describeWarning } from "@/features/setup/warnings";
import { listTemplates } from "@/features/templates/repository";
import { listApprovers, listWorkflows } from "@/features/workflows/repository";
import { requireConfiguration } from "@/lib/auth/configuration";

export const metadata: Metadata = { title: "Category" };

export default async function CategoryPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/categories/[categoryId]">) {
  const { orgSlug, categoryId } = await params;
  const { organisation } = await requireConfiguration(orgSlug);
  const id = organisation.id;
  const [category, departments, templates, workflows, roles, people, warnings] = await Promise.all([
    getCategory(id, categoryId),
    listDepartments(id),
    listTemplates(id, "request"),
    listWorkflows(id, "request"),
    listRoles(id),
    listApprovers(id, "requests.approve"),
    listSetupWarnings(id),
  ]);
  if (!category && categoryId !== "new") notFound();
  const warning = warnings.find(
    (w) => w.code === "category_approvers" && w.subject_id === category?.id,
  );
  return (
    <>
      <Link
        href={`/o/${orgSlug}/configuration/categories`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← Categories
      </Link>
      <PageHeader title={category?.name ?? "New category"} />
      <Card className="max-w-3xl space-y-6 p-6">
        {warning && <Notice tone="alert">{describeWarning(warning, `/o/${orgSlug}`).text}</Notice>}
        <CategoryForm
          orgId={id}
          slug={orgSlug}
          category={category ?? undefined}
          departments={departments}
          templates={templates}
          workflows={workflows}
          people={people}
          roles={roles.filter((r) => r.permissions.some((p) => p.key === "requests.approve"))}
        />
        {category && <ArchiveCategory orgId={id} slug={orgSlug} id={category.id} />}
      </Card>
    </>
  );
}
