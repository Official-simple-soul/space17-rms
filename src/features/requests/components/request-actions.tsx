"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { TextArea, TextField } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { formatMoney, parseMoney } from "@/lib/format";
import { confirmItem, decideRequest, deleteDraft, handOverItem, withdrawRequest } from "../actions";
import type { RequestDetail } from "../schema";

type Item = RequestDetail["items"][number];
const current = (i: Item) => i.approved_minor ?? i.line_total_minor;

function ApproveForm({
  stepId,
  lock,
  items,
  currency,
}: {
  stepId: string;
  lock: number;
  items: Item[];
  currency: string;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const read = (i: Item) => (amounts[i.id] === undefined ? current(i) : parseMoney(amounts[i.id]));
  const reductions = items.flatMap((i) => {
    const value = read(i);
    // An unreadable amount is sent as null, which the server refuses.
    return value === current(i) ? [] : [{ id: i.id, approved_minor: value }];
  });
  const total = items.reduce((sum, i) => sum + (read(i) ?? 0), 0);
  return (
    <ActionForm action={decideRequest} submit="Approve" variant="brand" closeOnSuccess>
      {(state) => (
        <>
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="lock" value={lock} />
          <input type="hidden" name="decision" value="approve" />
          <input type="hidden" name="items" value={JSON.stringify(reductions)} />
          {items.map((i) => {
            const value = read(i);
            return (
              <TextField
                key={i.id}
                label={i.description}
                name={`amount:${i.id}`}
                inputMode="decimal"
                value={amounts[i.id] ?? (current(i) / 100).toFixed(2)}
                onChange={(e) => setAmounts((all) => ({ ...all, [i.id]: e.target.value }))}
                hint={`Up to ${formatMoney(current(i), currency)}`}
                errors={
                  value === null
                    ? ["Enter an amount, such as 12,500."]
                    : value > current(i)
                      ? [`Can't be more than ${formatMoney(current(i), currency)}.`]
                      : undefined
                }
              />
            );
          })}
          {items.length > 0 && (
            <p className="rounded-control flex justify-between bg-neutral-100 p-3 text-sm font-semibold">
              <span>You&apos;re approving</span>
              <span className="tabular-nums">{formatMoney(total, currency)}</span>
            </p>
          )}
          <TextArea
            label={reductions.length ? "Reason for the reduction" : "Comment (optional)"}
            name="comment"
            maxLength={1000}
            errors={state.fieldErrors?.comment ?? state.fieldErrors?.items}
          />
        </>
      )}
    </ActionForm>
  );
}

function ReasonForm({
  stepId,
  lock,
  decision,
}: {
  stepId: string;
  lock: number;
  decision: "return" | "reject";
}) {
  return (
    <ActionForm
      action={decideRequest}
      submit={decision === "return" ? "Return request" : "Reject request"}
      variant="brand"
      closeOnSuccess
    >
      {(state) => (
        <>
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="lock" value={lock} />
          <input type="hidden" name="decision" value={decision} />
          <input type="hidden" name="items" value="[]" />
          <TextArea
            label="Reason"
            name="comment"
            maxLength={1000}
            hint="The requester will see this."
            errors={state.fieldErrors?.comment}
          />
        </>
      )}
    </ActionForm>
  );
}

export function DecisionPanel({ request: r, stepId }: { request: RequestDetail; stepId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <FormDialog
        label="Approve"
        title={`Approve ${r.number}`}
        description="You can reduce amounts, but not raise them."
        variant="brand"
      >
        <ApproveForm stepId={stepId} lock={r.lock_version} items={r.items} currency={r.currency} />
      </FormDialog>
      <FormDialog
        label="Return"
        title={`Return ${r.number}`}
        description="The requester can change it and submit again."
        variant="outline"
      >
        <ReasonForm stepId={stepId} lock={r.lock_version} decision="return" />
      </FormDialog>
      <FormDialog
        label="Reject"
        title={`Reject ${r.number}`}
        description="This ends the request."
        variant="outline"
      >
        <ReasonForm stepId={stepId} lock={r.lock_version} decision="reject" />
      </FormDialog>
    </div>
  );
}

export function WithdrawButton({ id, slug, lock }: { id: string; slug: string; lock: number }) {
  return (
    <FormDialog
      label="Withdraw"
      title="Withdraw this request"
      description="This ends the request. You can create a new one later."
      variant="outline"
    >
      <ActionForm action={withdrawRequest} submit="Withdraw request" variant="brand" closeOnSuccess>
        {(state) => (
          <>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="lock" value={lock} />
            <TextArea
              label="Reason"
              name="reason"
              maxLength={1000}
              errors={state.fieldErrors?.reason}
            />
          </>
        )}
      </ActionForm>
    </FormDialog>
  );
}

export function DeleteDraft({ id, slug }: { id: string; slug: string }) {
  return (
    <ActionForm
      action={deleteDraft}
      submit="Delete draft"
      variant="danger"
      className="space-y-3"
      confirm={{ title: "Delete this draft?", description: "Its files will be deleted too." }}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="slug" value={slug} />
        </>
      )}
    </ActionForm>
  );
}

/** For Finance, the head or an approver: records that the item reached the requester. */
export function HandOverForm({ request: r }: { request: RequestDetail }) {
  return (
    <ActionForm
      action={handOverItem}
      submit="Mark as handed over"
      variant="brand"
      fullWidth
      className="space-y-4"
      confirm={{
        title: `Hand this to ${r.requester}?`,
        description: "They'll be asked to confirm they've got it.",
      }}
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="lock" value={r.lock_version} />
          <TextArea
            label="Note (optional)"
            name="note"
            maxLength={500}
            hint="Such as a serial number or who delivered it."
            errors={state.fieldErrors?.note}
          />
        </>
      )}
    </ActionForm>
  );
}

/** For the requester, once it has been handed over. */
export function ConfirmItemForm({ request: r }: { request: RequestDetail }) {
  return (
    <ActionForm action={confirmItem} submit="I've got it" variant="brand" fullWidth>
      {() => (
        <>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="lock" value={r.lock_version} />
        </>
      )}
    </ActionForm>
  );
}
