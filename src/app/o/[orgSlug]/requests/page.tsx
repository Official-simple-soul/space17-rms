import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { listCategories } from "@/features/categories/repository";
import { listDepartments } from "@/features/departments/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { RequestsView } from "@/features/requests/components/requests-view";
import { listRequests } from "@/features/requests/repository";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/requests">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const { organisation, permissions, can } = await requireSection(orgSlug, "requests");
  const seesMore = permissions.some(
    (p) => p.permission_key === "requests.view" && p.scope !== "own",
  );
  const creates = can("requests.create");
  const tabs = [
    ...(creates ? [{ id: "mine", label: "My requests" }] : []),
    ...(seesMore ? [{ id: "all", label: "All requests" }] : []),
  ] as { id: "mine" | "all"; label: string }[];
  const base = `/o/${orgSlug}/requests`;
  const mode = tabs.find((t) => t.id === query.tab)?.id ?? tabs[0]?.id ?? "mine";
  const [requests, categories, departments, details, view] = await Promise.all([
    listRequests(organisation.id, mode, query),
    listCategories(organisation.id),
    listDepartments(organisation.id),
    getOrganisation(organisation.id),
    getListView(),
  ]);
  return (
    <>
      <PageHeader
        title="Requests"
        description="Ask for what you need and follow its progress."
        action={
          creates && (
            <Link href={`${base}/new`} className={buttonStyles({ variant: "brand" })}>
              <Plus className="size-4" aria-hidden />
              New request
            </Link>
          )
        }
      />
      {tabs.length > 1 && <LinkTabs label="Request lists" base={base} current={mode} tabs={tabs} />}
      <RequestsView
        key={mode}
        mode={mode}
        {...requests}
        view={view}
        base={base}
        currency={details.currency}
        now={new Date().toISOString()}
        categories={categories}
        departments={departments}
      />
    </>
  );
}
