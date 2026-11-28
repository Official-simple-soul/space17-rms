"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Badge } from "@/components/ui/surface";
import { formatDate, formatMoney } from "@/lib/format";
import { decideAdjustment, proposeAdjustment } from "../actions";
import type { ReportDetail } from "../schema";

const LABEL = { proposed: "Waiting", approved: "Approved", rejected: "Rejected" } as const;

/** Corrections to an approved report. One person proposes; someone else decides. */
export function Adjustments({ report: r }: { report: ReportDetail }) {
  const signed = (minor: number) =>
    `${minor > 0 ? "+" : "−"}${formatMoney(Math.abs(minor), r.currency)}`;
  return (
    <div className="space-y-4">
      {r.adjustments.length === 0 ? (
        <p className="text-muted text-sm">No corrections.</p>
      ) : (
        <ul className="divide-line divide-y text-sm">
          {r.adjustments.map((a) => (
            <li key={a.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`font-semibold tabular-nums ${a.status === "rejected" ? "line-through" : ""}`}
                >
                  {signed(a.amount_minor)}
                </span>
                <Badge
                  tone={
                    a.status === "approved"
                      ? "solid"
                      : a.status === "rejected"
                        ? "alert"
                        : "neutral"
                  }
                >
                  {LABEL[a.status]}
                </Badge>
              </div>
              <p>{a.reason}</p>
              <p className="text-muted text-xs">
                Proposed by {a.proposed_by} on {formatDate(a.proposed_at)}
                {a.decided_by && ` · ${LABEL[a.status].toLowerCase()} by ${a.decided_by}`}
                {a.decision_note && `: ${a.decision_note}`}
              </p>
              {a.can_decide && (
                <div className="flex flex-wrap gap-2">
                  <ActionForm
                    action={decideAdjustment}
                    submit="Approve"
                    variant="brand"
                    size="sm"
                    className="space-y-2"
                  >
                    {() => (
                      <>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <input type="hidden" name="note" value="" />
                      </>
                    )}
                  </ActionForm>
                  <FormDialog
                    label="Reject"
                    title="Reject this correction"
                    variant="outline"
                    size="sm"
                  >
                    <ActionForm
                      action={decideAdjustment}
                      submit="Reject"
                      variant="danger"
                      closeOnSuccess
                    >
                      {(state) => (
                        <>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="decision" value="reject" />
                          <TextArea
                            label="Why?"
                            name="note"
                            maxLength={500}
                            errors={state.fieldErrors?.note}
                          />
                        </>
                      )}
                    </ActionForm>
                  </FormDialog>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {r.adjusted_minor !== 0 && (
        <p className="text-sm font-medium">Approved corrections: {signed(r.adjusted_minor)}</p>
      )}
      {r.can_adjust && (
        <FormDialog
          label="Propose a correction"
          title="Propose a correction"
          description="For example, a refund received after approval. Someone else must approve it."
          variant="outline"
          size="sm"
        >
          <ActionForm action={proposeAdjustment} submit="Propose" variant="brand" closeOnSuccess>
            {(state) => (
              <>
                <input type="hidden" name="reportId" value={r.id} />
                <SelectField label="Change" name="direction" defaultValue="remove">
                  <option value="remove">Take away from the total</option>
                  <option value="add">Add to the total</option>
                </SelectField>
                <TextField
                  label={`Amount, ${r.currency}`}
                  name="amount"
                  inputMode="decimal"
                  errors={state.fieldErrors?.amount}
                />
                <TextArea
                  label="Why?"
                  name="reason"
                  maxLength={500}
                  errors={state.fieldErrors?.reason}
                />
              </>
            )}
          </ActionForm>
        </FormDialog>
      )}
    </div>
  );
}
