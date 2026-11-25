import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { CategoriesView } from "@/features/categories/components/categories-view";
import { listCategories } from "@/features/categories/repository";
import { ConfigurationHeader } from "@/features/configuration/components/configuration-header";
import { listDepartments } from "@/features/departments/repository";
import { StarterSet } from "@/features/setup/components/starter-set";
import { getSetupCounts, listSetupWarnings } from "@/features/setup/repository";
import { listWorkflows } from "@/features/workflows/repository";
import { requireConfiguration } from "@/lib/auth/configuration";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/categories">) {
  const { orgSlug } = await params;
  const { organisation } = await requireConfiguration(orgSlug);
  const [categories, departments, workflows, warnings, counts, view] = await Promise.all([
    listCategories(organisation.id),
    listDepartments(organisation.id),
    listWorkflows(organisation.id, "request"),
    listSetupWarnings(organisation.id),
    getSetupCounts(organisation.id),
    getListView(),
  ]);
  const department = new Map(departments.map((d) => [d.id, d.name]));
  const workflow = new Map(workflows.map((w) => [w.id, w.name]));
  const short = new Set(
    warnings.filter((w) => w.code === "category_approvers").map((w) => w.subject_id),
  );
  const base = `/o/${orgSlug}/configuration/categories`;
  return (
    <>
      <ConfigurationHeader
        slug={orgSlug}
        current="categories"
        action={
          <Link href={`${base}/new`} className={buttonStyles({ variant: "brand" })}>
            <Plus className="size-4" aria-hidden />
            New category
          </Link>
        }
      />
      {counts.categories + counts.templates + counts.workflows === 0 && (
        <StarterSet orgId={organisation.id} />
      )}
      <CategoriesView
        view={view}
        base={base}
        departments={departments}
        rows={categories.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          appliesTo: c.appliesTo,
          departmentIds: c.departmentIds,
          departments:
            c.departmentIds.flatMap((d) => department.get(d) ?? []).join(", ") || "All departments",
          workflow:
            c.appliesTo === "expense"
              ? "Not needed"
              : (c.workflowId && workflow.get(c.workflowId)) || "One approval",
          warning: short.has(c.id),
        }))}
      />
    </>
  );
}
