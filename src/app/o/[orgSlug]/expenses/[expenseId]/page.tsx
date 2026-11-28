import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import {
  AddEvidence,
  DecideExpense,
  DeleteExpense,
  RemoveFromReport,
  WithdrawExpense,
} from "@/features/expenses/components/expense-actions";
import { ExpenseFlags, ExpenseStatusBadge } from "@/features/expenses/components/expense-badges";
import { ExpenseDetails, ExpenseTimeline } from "@/features/expenses/components/expense-details";
import { getExpense } from "@/features/expenses/repository";
import { MarkRead } from "@/features/notifications/components/mark-read";
import { getOrganisation } from "@/features/organisations/repository";
import { RepaymentCard } from "@/features/payments/components/repayment-card";
import { ReceiptCard } from "@/features/receipts/components/receipt-card";
import { getRepaymentAccount } from "@/features/payments/repository";
import { getMyWork } from "@/features/requests/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { formatDate, formatMoney, todayIn } from "@/lib/format";

export const metadata: Metadata = { title: "Expense" };

export default async function ExpensePage({
  params,
}: PageProps<"/o/[orgSlug]/expenses/[expenseId]">) {
  const { orgSlug, expenseId } = await params;
  const { organisation } = await getOrganisationContext(orgSlug);
  const [expense, work] = await Promise.all([
    getExpense(organisation.id, expenseId),
    getMyWork(organisation.id),
  ]);
  if (!expense) notFound();
  const [bank, details] = await Promise.all([
    expense.repayment?.can_pay ? getRepaymentAccount(expense.id) : null,
    getOrganisation(organisation.id),
  ]);
  const base = `/o/${orgSlug}`;
  const back = expense.can_decide ? `${base}/expenses?tab=inbox` : `${base}/expenses`;
  const editable = expense.is_mine && (expense.status === "draft" || expense.status === "returned");
  const withdrawable =
    expense.is_mine && (expense.status === "submitted" || expense.status === "returned");
  const last = expense.events.find((e) => ["returned", "rejected", "removed"].includes(e.type));
  const flags = expense.status === "draft" || expense.status === "cancelled" ? [] : expense.flags;
  return (
    <>
      {work.unread > 0 && <MarkRead orgId={organisation.id} subjectId={expense.id} />}
      <Link href={back} className="text-muted mb-4 inline-block text-sm font-medium">
        ← Expenses
      </Link>
      <PageHeader
        title={expense.description || "Untitled expense"}
        description={
          expense.submitted_at
            ? `${formatMoney(expense.total_minor, expense.currency)} · Submitted ${formatDate(expense.submitted_at)}`
            : "Not submitted yet"
        }
        action={<ExpenseStatusBadge status={expense.status} />}
      />
      {last && (expense.status === "returned" || expense.status === "rejected") && (
        <div className="mb-6">
          <Notice tone="alert">
            {last.actor} {expense.status} this: {last.body}
          </Notice>
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ExpenseDetails expense={expense} base={base} />
          {expense.events.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 font-semibold">Activity</h2>
              <ExpenseTimeline events={expense.events} />
            </Card>
          )}
        </div>
        <div className="order-first space-y-6 lg:sticky lg:top-6 lg:order-none">
          {flags.length > 0 && (
            <Card className="space-y-3 p-6">
              <h2 className="font-semibold">Check these</h2>
              <ExpenseFlags flags={flags} />
            </Card>
          )}
          {expense.can_decide && (
            <Card className="space-y-4 p-6">
              <h2 className="font-semibold">Your decision</h2>
              <DecideExpense expense={expense} />
            </Card>
          )}
          <ReceiptCard expense={expense} base={base} />
          <RepaymentCard
            expense={expense}
            bank={bank}
            filesBase={`${base}/files`}
            today={todayIn(details.timezone)}
          />
          {expense.can_add_evidence && (
            <Card className="space-y-4 p-6">
              <h2 className="font-semibold">Add evidence</h2>
              <AddEvidence expense={expense} />
            </Card>
          )}
          {(editable || withdrawable || expense.can_remove) && (
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Link
                  href={`${base}/expenses/${expense.id}/edit`}
                  className={buttonStyles({ variant: "primary" })}
                >
                  {expense.status === "draft" ? "Continue" : "Edit and resubmit"}
                </Link>
              )}
              {withdrawable && <WithdrawExpense expense={expense} />}
              {expense.status === "draft" && <DeleteExpense id={expense.id} slug={orgSlug} />}
              {expense.can_remove && <RemoveFromReport expense={expense} />}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
