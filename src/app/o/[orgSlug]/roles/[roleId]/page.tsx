import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { ArchiveRole, RoleForm } from "@/features/roles/components/role-form";
import { listPermissions, listRoles } from "@/features/roles/repository";
import { requireSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Role" };

export default async function RolePage({ params }: PageProps<"/o/[orgSlug]/roles/[roleId]">) {
  const { orgSlug, roleId } = await params;
  const { organisation } = await requireSection(orgSlug, "roles");
  const [roles, permissions] = await Promise.all([listRoles(organisation.id), listPermissions()]);
  const role = roles.find((r) => r.id === roleId);
  if (!role && roleId !== "new") notFound();
  return (
    <>
      <Link
        href={`/o/${orgSlug}/roles`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← Roles
      </Link>
      <PageHeader
        title={role?.name ?? "New role"}
        description="A role covers either one department or the whole organisation."
      />
      <Card className="max-w-3xl space-y-6 p-6">
        {role?.systemKey === "admin" && (
          <Notice>The admin role is fixed so the organisation can always be managed.</Notice>
        )}
        <RoleForm orgId={organisation.id} slug={orgSlug} permissions={permissions} role={role} />
        {role && !role.systemKey && (
          <ArchiveRole orgId={organisation.id} slug={orgSlug} id={role.id} />
        )}
      </Card>
    </>
  );
}
