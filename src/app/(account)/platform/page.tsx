import { Building2, Inbox } from "lucide-react";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import {
  DeclineRequest,
  InviteForm,
  RevokeInvite,
  StatusForm,
} from "@/features/platform/components/forms";
import { getPlatformOverview } from "@/features/platform/repository";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Platform" };

export default async function PlatformPage() {
  await requirePlatformAdmin();
  const { organisations, invites, requests } = await getPlatformOverview();
  return (
    <>
      <PageHeader
        title="Platform"
        description="Organisations and invitations. Organisation content stays private."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="border-line border-b p-5 font-semibold">
            Organisations <span className="text-muted">({organisations.length})</span>
          </h2>
          {organisations.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No organisations"
              description="Create an invitation to add the first one."
            />
          ) : (
            <ul className="divide-line divide-y">
              {organisations.map((o) => (
                <li key={o.id} className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{o.name}</p>
                      <p className="text-muted text-sm">
                        /{o.slug} · {formatDate(o.created_at)}
                      </p>
                    </div>
                    <Badge tone={o.status === "suspended" ? "alert" : "neutral"}>{o.status}</Badge>
                  </div>
                  <details className="mt-3 text-sm">
                    <summary className="text-muted cursor-pointer font-medium">
                      Manage access
                    </summary>
                    <StatusForm id={o.id} suspended={o.status === "suspended"} />
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Invite an organisation</h2>
            <InviteForm />
          </Card>
          {invites.length > 0 && (
            <Card>
              <h2 className="border-line border-b p-5 font-semibold">Open invitations</h2>
              <ul className="divide-line divide-y">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{i.email}</p>
                      <p className="text-muted text-xs">Expires {formatDate(i.expires_at)}</p>
                    </div>
                    <RevokeInvite id={i.id} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <h2 className="border-line border-b p-5 font-semibold">Access requests</h2>
            {requests.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="All clear"
                description="New requests will appear here."
              />
            ) : (
              <ul className="divide-line divide-y">
                {requests.map((r) => (
                  <li key={r.id} className="space-y-3 p-5">
                    <div>
                      <p className="font-medium">{r.org_name}</p>
                      <p className="text-muted text-sm">
                        {r.contact_name} · {r.email}
                      </p>
                      {r.message && <p className="mt-2 text-sm">{r.message}</p>}
                    </div>
                    <DeclineRequest id={r.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
