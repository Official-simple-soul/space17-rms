import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { listMembers } from "@/features/members/repository";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "People" };

export default async function MembersPage({ params }: PageProps<"/o/[orgSlug]/members">) {
  const { orgSlug } = await params;
  const { organisation } = await getOrganisationContext(orgSlug);
  const members = await listMembers(organisation.id);
  return (
    <>
      <PageHeader title="People" description="Everyone with access to this organisation." />
      <Card>
        <ul className="divide-line divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-4 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 font-semibold">
                {m.name[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-muted truncate text-sm">{m.roles.join(", ") || "No role"}</p>
              </div>
              <Badge tone={m.status === "active" ? "neutral" : "alert"}>{m.status}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
