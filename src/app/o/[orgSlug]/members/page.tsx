import { Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import { FormDialog } from "@/components/ui/form-dialog";
import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { listDepartments } from "@/features/departments/repository";
import { BulkInviteForm, InviteForm } from "@/features/members/components/member-forms";
import { InvitationsView, MembersView } from "@/features/members/components/members-view";
import { countMembers, listInvitations, listMembers } from "@/features/members/repository";
import { listRoles } from "@/features/roles/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "People" };

export default async function MembersPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/members">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const { tab } = query;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  const manage = can("members.manage");
  const [people, count, departments, roles, invitations, view] = await Promise.all([
    listMembers(organisation.id, query),
    countMembers(organisation.id),
    listDepartments(organisation.id),
    listRoles(organisation.id),
    manage ? listInvitations(organisation.id) : [],
    getListView(),
  ]);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const base = `/o/${orgSlug}/members`;
  const current = manage && tab === "invitations" ? "invitations" : "people";
  return (
    <>
      <PageHeader
        title="People"
        description={`${count} ${count === 1 ? "person" : "people"} across the organisation.`}
        action={
          manage && (
            <div className="flex flex-wrap gap-2">
              <FormDialog
                label={
                  <>
                    <Upload className="size-4" aria-hidden />
                    Import
                  </>
                }
                title="Invite several people"
                variant="outline"
              >
                <BulkInviteForm orgId={organisation.id} />
              </FormDialog>
              <FormDialog
                label={
                  <>
                    <Plus className="size-4" aria-hidden />
                    Invite person
                  </>
                }
                title="Invite someone"
                description="They'll join with the role you choose."
                variant="brand"
              >
                <InviteForm orgId={organisation.id} roles={roles} departments={departments} />
              </FormDialog>
            </div>
          )
        }
      />
      {manage && (
        <LinkTabs
          label="People sections"
          base={base}
          current={current}
          tabs={[
            { id: "people", label: "People", count: count },
            { id: "invitations", label: "Invitations", count: invitations.length },
          ]}
        />
      )}
      {current === "invitations" ? (
        <InvitationsView
          view={view}
          orgId={organisation.id}
          rows={invitations.map((i) => ({
            id: i.id,
            email: i.email,
            role: roleName.get(i.role_id) ?? "",
            expiresAt: i.expires_at,
          }))}
        />
      ) : (
        <MembersView
          view={view}
          base={base}
          canManage={manage}
          departments={departments}
          roles={roles}
          rows={people.rows}
          server={{ page: people.page, pageSize: people.pageSize, total: people.total }}
        />
      )}
    </>
  );
}
