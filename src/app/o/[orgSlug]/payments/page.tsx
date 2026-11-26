import type { Metadata } from "next";
import { MfaNotice } from "@/components/layout/mfa-notice";
import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { listDepartments } from "@/features/departments/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { PayableView, PaymentsView } from "@/features/payments/components/payments-view";
import { listPayable, listPayments } from "@/features/payments/repository";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/payments">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const { session, organisation } = await requireSection(orgSlug, "payments");
  const history = query.tab === "history";
  const [details, departments, view] = await Promise.all([
    getOrganisation(organisation.id),
    listDepartments(organisation.id),
    getListView(),
  ]);
  const shared = { view, base: `/o/${orgSlug}/requests`, currency: details.currency };
  return (
    <>
      <MfaNotice aal={session.aal} />
      <PageHeader title="Payments" description="Record payments for approved requests." />
      <LinkTabs
        label="Payment lists"
        base={`/o/${orgSlug}/payments`}
        current={history ? "history" : "due"}
        tabs={[
          { id: "due", label: "Due" },
          { id: "history", label: "History" },
        ]}
      />
      {history ? (
        <PaymentsView key="history" {...shared} {...await listPayments(organisation.id, query)} />
      ) : (
        <PayableView
          key="due"
          {...shared}
          {...await listPayable(organisation.id, query)}
          departments={departments}
        />
      )}
    </>
  );
}
