import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Card, Notice, PageHeader } from "@/components/ui/surface";
import { ExpenseStatusBadge } from "@/features/expenses/components/expense-badges";
import { listRequestExpenses } from "@/features/expenses/repository";
import { MarkRead } from "@/features/notifications/components/mark-read";
import { getOrganisation } from "@/features/organisations/repository";
import { PaymentsCard } from "@/features/payments/components/payments-card";
import {
  DecisionPanel,
  DeleteDraft,
  WithdrawButton,
  ConfirmItemForm,
  HandOverForm,
} from "@/features/requests/components/request-actions";
import {
  ApprovalSteps,
  RequestDetails,
  Timeline,
} from "@/features/requests/components/request-details";
import { StatusBadge } from "@/features/requests/components/status-badge";
import { getMyWork, getRequest } from "@/features/requests/repository";
import { Chat } from "@/components/ui/chat";
import { sendRequestMessage } from "@/features/requests/actions";
import { getOrganisationContext } from "@/lib/auth/session";
import { formatDate, formatMoney, todayIn } from "@/lib/format";

export const metadata: Metadata = { title: "Request" };

export default async function RequestPage({
  params,
}: PageProps<"/o/[orgSlug]/requests/[requestId]">) {
  const { orgSlug, requestId } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  const [details, request, work] = await Promise.all([
    getOrganisation(organisation.id),
    getRequest(organisation.id, requestId),
    getMyWork(organisation.id),
  ]);
  if (!request) notFound();
  const base = `/o/${orgSlug}/requests`;
  const expenses = await listRequestExpenses(request.id);
  // Only money given to the requester is accounted for with expenses.
  const spendable =
    request.is_requester &&
    request.provision === "money" &&
    can("expenses.create") &&
    ["approved", "part_paid", "paid", "received"].includes(request.status);
  const editable =
    request.is_requester && (request.status === "draft" || request.status === "returned");
  const withdrawable =
    request.is_requester && (request.status === "pending" || request.status === "returned");
  const lastReason = request.events.find((e) => e.type === "returned" || e.type === "rejected");
  return (
    <>
      {work.unread > 0 && <MarkRead orgId={organisation.id} subjectId={request.id} />}
      <Link href={base} className="text-muted mb-4 inline-block text-sm font-medium">
        ← Requests
      </Link>
      <PageHeader
        title={request.title || "Untitled request"}
        description={
          request.number
            ? `${request.number} · Submitted ${formatDate(request.submitted_at!)}`
            : "Not submitted yet"
        }
        action={<StatusBadge status={request.status} provision={request.provision ?? undefined} />}
      />
      {request.is_requester && request.chat.status === "open" && (
        <div className="mb-6">
          <Notice tone="alert">
            {request.chat.messages.findLast((m) => m.question)?.author ?? "Someone"} asked you a
            question.{" "}
            <a href="#conversation" className="font-medium underline">
              Answer it
            </a>
          </Notice>
        </div>
      )}
      {lastReason && (request.status === "returned" || request.status === "rejected") && (
        <div className="mb-6">
          <Notice tone="alert">
            {lastReason.actor} {lastReason.type} this: {lastReason.body}
          </Notice>
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <RequestDetails request={request} filesBase={`/o/${orgSlug}/files`} />
          {request.status !== "draft" && (
            <Card id="conversation" className="scroll-mt-6 p-6">
              <h2 className="font-semibold">Conversation</h2>
              <p className="text-muted mt-1 mb-5 text-sm">
                Questions and answers about this request. Everyone who can see it can read them.
              </p>
              <Chat
                messages={request.chat.messages}
                send={sendRequestMessage}
                fields={{ id: request.id }}
                canSend={request.can_message}
                askLabel={request.can_ask ? `Ask ${request.requester} to answer this` : undefined}
                empty="No messages yet."
                placeholder={
                  request.is_requester ? "Write a message" : `Write to ${request.requester}`
                }
              />
            </Card>
          )}
          {request.status !== "draft" && (
            <Card className="p-6">
              <h2 className="mb-4 font-semibold">Activity</h2>
              <Timeline
                events={request.events.filter((e) => e.type !== "commented")}
                currency={request.currency}
              />
            </Card>
          )}
        </div>
        <div className="order-first space-y-6 lg:sticky lg:top-6 lg:order-none">
          {request.my_step && (
            <Card className="space-y-4 p-6">
              <h2 className="font-semibold">Your decision</h2>
              <DecisionPanel request={request} stepId={request.my_step} />
            </Card>
          )}
          {request.is_requester && request.status === "pending" && (
            <Notice>
              You can&apos;t approve your own request. We&apos;ll tell you when it&apos;s decided.
            </Notice>
          )}
          {request.already_decided && (
            <Notice>You&apos;ve approved this step. It&apos;s waiting for someone else.</Notice>
          )}
          {request.can_confirm_item && (
            <Card className="space-y-4 p-6">
              <div>
                <h2 className="font-semibold">Have you got it?</h2>
                <p className="text-muted mt-1 text-sm">
                  {request.handover?.by} handed this over
                  {request.handover?.at && ` on ${formatDate(request.handover.at)}`}.
                  {request.handover?.note && ` ${request.handover.note}`}
                </p>
              </div>
              <ConfirmItemForm request={request} />
            </Card>
          )}
          {request.can_hand_over && (
            <Card className="space-y-4 p-6">
              <div>
                <h2 className="font-semibold">Hand it over</h2>
                <p className="text-muted mt-1 text-sm">
                  Give {request.requester} one you already have, or buy one. If you buy it, add the
                  purchase as an expense with the receipt so it&apos;s in the monthly report.
                </p>
              </div>
              {can("expenses.create") && (
                <Link
                  href={`/o/${orgSlug}/expenses/new?request=${request.id}`}
                  className={buttonStyles({ variant: "outline", className: "w-full" })}
                >
                  Add the purchase as an expense
                </Link>
              )}
              <HandOverForm request={request} />
            </Card>
          )}
          {request.handover && !request.can_confirm_item && (
            <Card className="space-y-1 p-6 text-sm">
              <h2 className="mb-2 font-semibold">Handed over</h2>
              <p>
                By {request.handover.by} on {formatDate(request.handover.at)}
                {request.handover.note && `: ${request.handover.note}`}
              </p>
              <p className="text-muted">
                {request.handover.received_at
                  ? `${request.requester} confirmed receiving it on ${formatDate(request.handover.received_at)}.`
                  : `Waiting for ${request.requester} to confirm.`}
              </p>
            </Card>
          )}
          {request.needs_bank && (
            <Notice>
              <Link href={`/o/${orgSlug}/bank-details`} className="font-medium underline">
                Add your bank details
              </Link>{" "}
              so you can be paid.
            </Notice>
          )}
          <PaymentsCard
            request={request}
            filesBase={`/o/${orgSlug}/files`}
            today={todayIn(details.timezone)}
          />
          {(spendable || expenses.length > 0) && (
            <Card className="space-y-4 p-6">
              <h2 className="font-semibold">Expenses</h2>
              {expenses.length > 0 && (
                <ul className="space-y-3 text-sm">
                  {expenses.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3">
                      <Link href={`/o/${orgSlug}/expenses/${e.id}`} className="hover:underline">
                        {e.description || "Untitled expense"}
                        <span className="text-muted block text-xs tabular-nums">
                          {formatMoney(e.total_minor, request.currency)}
                        </span>
                      </Link>
                      <ExpenseStatusBadge status={e.status} />
                    </li>
                  ))}
                </ul>
              )}
              {spendable && (
                <Link
                  href={`/o/${orgSlug}/expenses/new?request=${request.id}`}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Add expense
                </Link>
              )}
            </Card>
          )}
          {request.steps.length > 0 && (
            <Card className="space-y-5 p-6">
              <h2 className="font-semibold">Approval</h2>
              <ApprovalSteps steps={request.steps} />
            </Card>
          )}
          {(editable || withdrawable) && (
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Link
                  href={`${base}/${request.id}/edit`}
                  className={buttonStyles({ variant: "primary" })}
                >
                  {request.status === "draft" ? "Continue" : "Edit and resubmit"}
                </Link>
              )}
              {withdrawable && (
                <WithdrawButton id={request.id} slug={orgSlug} lock={request.lock_version} />
              )}
              {request.status === "draft" && <DeleteDraft id={request.id} slug={orgSlug} />}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
