import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/ui/pager";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { MarkAllRead } from "@/features/notifications/components/mark-read";
import { notificationMessage, notificationPath } from "@/features/notifications/message";
import { listNotifications } from "@/features/notifications/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/notifications">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const { organisation } = await getOrganisationContext(orgSlug);
  const { rows, server } = await listNotifications(organisation.id, query);
  const base = `/o/${orgSlug}/notifications`;
  const unread = query.show === "unread";
  return (
    <>
      <PageHeader
        title="Notifications"
        action={rows.some((n) => !n.read_at) && <MarkAllRead orgId={organisation.id} />}
      />
      <LinkTabs
        label="Notification lists"
        current={unread ? "unread" : "all"}
        tabs={[
          { id: "all", label: "All", href: base },
          { id: "unread", label: "Unread", href: `${base}?show=unread` },
        ]}
      />
      <Card>
        {rows.length ? (
          <ul className="divide-line divide-y">
            {rows.map((n) => (
              <li key={n.id}>
                <Link
                  href={notificationPath(`/o/${orgSlug}`, n.type, n.request_id)}
                  className="flex gap-3 px-5 py-4 text-sm hover:bg-neutral-50"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand"}`}
                    aria-hidden
                  />
                  <span className={n.read_at ? "" : "font-medium"}>
                    {!n.read_at && <span className="sr-only">Unread: </span>}
                    {notificationMessage(n.type, n.payload)}
                    <span className="text-muted block text-xs font-normal">
                      {formatDateTime(n.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Bell}
            title={unread ? "Nothing unread" : "No notifications yet"}
            description="Updates about your requests and approvals will appear here."
          />
        )}
        <Pager
          paging={server}
          href={(page) =>
            `${base}?${new URLSearchParams({ ...(unread && { show: "unread" }), page: String(page) })}`
          }
        />
      </Card>
    </>
  );
}
