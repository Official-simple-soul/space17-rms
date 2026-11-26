import type { Metadata } from "next";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { BankForm, RemoveBankAccount } from "@/features/bank/components/bank-form";
import { getMyBankAccount } from "@/features/bank/repository";
import { requireSection } from "@/lib/auth/access";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Bank details" };

export default async function BankDetailsPage({ params }: PageProps<"/o/[orgSlug]/bank-details">) {
  const { organisation } = await requireSection((await params).orgSlug, "bankDetails");
  const account = await getMyBankAccount(organisation.id);
  return (
    <>
      <PageHeader title="Bank details" description={`Where ${organisation.name} pays you.`} />
      <Card className="max-w-xl space-y-6 p-6">
        <Notice>
          Your account number is encrypted. Only people paying you can reveal it, and each time is
          recorded.
        </Notice>
        {account && (
          <dl className="text-sm">
            <dt className="text-muted text-xs">Saved account</dt>
            <dd className="mt-1 font-medium">{account.account_name}</dd>
            <dd>
              {account.bank_name} <span className="font-mono">•••• {account.last_digits}</span>
            </dd>
            <dd className="text-muted text-xs">Changed {formatDate(account.updated_at)}</dd>
          </dl>
        )}
        <BankForm orgId={organisation.id} account={account ?? undefined} />
        {account && <RemoveBankAccount orgId={organisation.id} />}
      </Card>
    </>
  );
}
