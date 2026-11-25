import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { FormDialog } from "@/components/ui/form-dialog";
import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { InviteForm } from "@/features/platform/components/forms";
import {
  InvitesView,
  OrganisationsView,
  RequestsView,
} from "@/features/platform/components/platform-views";
import { getPlatformOverview } from "@/features/platform/repository";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Platform" };

export default async function PlatformPage({ searchParams }: PageProps<"/platform">) {
  await requirePlatformAdmin();
  const { tab } = await searchParams;
  const [{ organisations, invites, requests }, view] = await Promise.all([
    getPlatformOverview(),
    getListView(),
  ]);
  const current = tab === "invitations" || tab === "requests" ? tab : "organisations";
  return (
    <>
      <PageHeader
        title="Platform"
        description="Organisations and invitations. Organisation content stays private."
        action={
          <FormDialog
            label={
              <>
                <Plus className="size-4" aria-hidden />
                Invite organisation
              </>
            }
            title="Invite an organisation"
            variant="brand"
          >
            <InviteForm />
          </FormDialog>
        }
      />
      <LinkTabs
        label="Platform sections"
        base="/platform"
        current={current}
        tabs={[
          { id: "organisations", label: "Organisations", count: organisations.length },
          { id: "invitations", label: "Invitations", count: invites.length },
          { id: "requests", label: "Access requests", count: requests.length },
        ]}
      />
      {current === "organisations" && <OrganisationsView rows={organisations} view={view} />}
      {current === "invitations" && <InvitesView rows={invites} view={view} />}
      {current === "requests" && <RequestsView rows={requests} view={view} />}
    </>
  );
}
