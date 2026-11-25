import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { listDepartments } from "@/features/departments/repository";
import {
  DepartmentsForm,
  GrantRoleForm,
  RevokeRole,
  StatusForm,
} from "@/features/members/components/member-forms";
import { getMember } from "@/features/members/repository";
import { listRoles } from "@/features/roles/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Person" };

export default async function MemberPage({ params }: PageProps<"/o/[orgSlug]/members/[memberId]">) {
  const { orgSlug, memberId } = await params;
  const { session, organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("members.manage")) notFound();
  const [member, departments, roles] = await Promise.all([
    getMember(organisation.id, memberId),
    listDepartments(organisation.id),
    listRoles(organisation.id),
  ]);
  if (!member) notFound();
  const ids = { orgId: organisation.id, memberId };
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  return (
    <>
      <Link
        href={`/o/${orgSlug}/members`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← People
      </Link>
      <PageHeader
        title={member.name}
        action={
          <Badge tone={member.status === "active" ? "neutral" : "alert"}>{member.status}</Badge>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="border-line border-b p-5 font-semibold">Roles</h2>
          <ul className="divide-line divide-y">
            {member.grants.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-medium">{roleName.get(g.role_id)}</p>
                  <p className="text-muted text-sm">
                    {[
                      g.department_id && departmentName.get(g.department_id),
                      g.valid_until && `until ${formatDate(g.valid_until)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Whole organisation"}
                  </p>
                </div>
                <RevokeRole orgId={organisation.id} grantId={g.id} />
              </li>
            ))}
          </ul>
          {member.status === "active" && (
            <div className="border-line border-t p-5">
              <GrantRoleForm {...ids} roles={roles} departments={departments} />
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Departments</h2>
            {departments.length ? (
              <DepartmentsForm
                {...ids}
                departments={departments}
                selected={member.departmentIds}
                primary={member.primaryDepartmentId}
              />
            ) : (
              <p className="text-muted text-sm">Add departments first.</p>
            )}
          </Card>
          {member.userId !== session.userId && (
            <Card className="space-y-6 p-5">
              <h2 className="font-semibold">Access</h2>
              {member.status === "active" ? (
                <StatusForm
                  {...ids}
                  slug={orgSlug}
                  status={member.status}
                  to="suspended"
                  label="Suspend"
                />
              ) : (
                <StatusForm
                  {...ids}
                  slug={orgSlug}
                  status={member.status}
                  to="active"
                  label="Reactivate"
                />
              )}
              <StatusForm
                {...ids}
                slug={orgSlug}
                status={member.status}
                to="left"
                label="Remove from organisation"
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
