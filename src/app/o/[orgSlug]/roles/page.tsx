import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";
import { RolesView } from "@/features/roles/components/roles-view";
import { getRoleCounts, listRoles } from "@/features/roles/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage({ params }: PageProps<"/o/[orgSlug]/roles">) {
  const { orgSlug } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("roles.manage")) notFound();
  const [roles, counts, view] = await Promise.all([
    listRoles(organisation.id),
    getRoleCounts(organisation.id),
    getListView(),
  ]);
  const base = `/o/${orgSlug}/roles`;
  return (
    <>
      <PageHeader
        title="Roles"
        description="What people can do, and where."
        action={
          <Link href={`${base}/new`} className={buttonStyles({ variant: "brand" })}>
            <Plus className="size-4" aria-hidden />
            New role
          </Link>
        }
      />
      <RolesView
        view={view}
        base={base}
        rows={roles.map((r) => ({
          id: r.id,
          name: r.name,
          isDefault: Boolean(r.systemKey),
          permissions: r.permissions.length,
          covers: r.needsDepartment
            ? "One department"
            : r.permissions.some((p) => p.scope === "org")
              ? "Whole organisation"
              : r.permissions.some((p) => p.scope === "category")
                ? "Assigned categories"
                : "Own items",
          people: counts.get(r.id) ?? 0,
        }))}
      />
    </>
  );
}
