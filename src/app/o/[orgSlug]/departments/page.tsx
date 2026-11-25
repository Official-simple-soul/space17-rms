import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { FormDialog } from "@/components/ui/form-dialog";
import { PageHeader } from "@/components/ui/surface";
import { DepartmentForm } from "@/features/departments/components/department-forms";
import { DepartmentsView } from "@/features/departments/components/departments-view";
import { getDepartmentOverview, listDepartments } from "@/features/departments/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage({ params }: PageProps<"/o/[orgSlug]/departments">) {
  const { orgSlug } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  const manage = can("org.manage");
  const [departments, overview, view] = await Promise.all([
    listDepartments(organisation.id),
    getDepartmentOverview(organisation.id),
    getListView(),
  ]);
  const names = new Map(departments.map((d) => [d.id, d.name]));
  const rows = departments.map((d) => {
    const info = overview.get(d.id);
    return {
      ...d,
      parent: (d.parent_id && names.get(d.parent_id)) || "",
      head: info?.head ?? "",
      deputies: info?.deputies.join(", ") ?? "",
      people: info?.people ?? 0,
    };
  });
  return (
    <>
      <PageHeader
        title="Departments"
        description="How the organisation is grouped for requests and reports."
        action={
          manage && (
            <FormDialog
              label={
                <>
                  <Plus className="size-4" aria-hidden />
                  Add department
                </>
              }
              title="Add a department"
              variant="brand"
            >
              <DepartmentForm orgId={organisation.id} departments={departments} />
            </FormDialog>
          )
        }
      />
      <DepartmentsView
        rows={rows}
        view={view}
        orgId={organisation.id}
        peopleBase={`/o/${orgSlug}/members`}
        canManage={manage}
      />
    </>
  );
}
