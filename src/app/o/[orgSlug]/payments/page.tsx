import type { Metadata } from "next";
import { MfaNotice } from "@/components/layout/mfa-notice";
import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { listDepartments } from "@/features/departments/repository";
import { getOrganisation } from "@/features/organisations/repository";
import {
  PayableView,
  PaymentsView,
  RepayableView,
} from "@/features/payments/components/payments-view";
import { listPayable, listPayments, listRepayable } from "@/features/payments/repository";
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
  const tab = query.tab === "history" || query.tab === "repay" ? query.tab : "due";
  const [details, departments, view] = await Promise.all([
    getOrganisation(organisation.id),
    listDepartments(organisation.id),
    getListView(),
  ]);
  const shared = { view, base: `/o/${orgSlug}`, currency: details.currency };
  return (
    <>
      <MfaNotice aal={session.aal} />
      <PageHeader
        title="Payments"
        description="Record money given for approved requests, and repay people who spent their own."
      />
      <LinkTabs
        label="Payment lists"
        base={`/o/${orgSlug}/payments`}
        current={tab}
        tabs={[
          { id: "due", label: "Requests" },
          { id: "repay", label: "Pay back" },
          { id: "history", label: "History" },
        ]}
      />
      {tab === "history" ? (
        <PaymentsView key="history" {...shared} {...await listPayments(organisation.id, query)} />
      ) : tab === "repay" ? (
        <RepayableView
          key="repay"
          {...shared}
          {...await listRepayable(organisation.id, query)}
          departments={departments}
        />
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
