"use client";

import { FileText, QrCode } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { buttonStyles } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Badge, Card, Notice } from "@/components/ui/surface";
import type { ExpenseDetail } from "@/features/expenses/schema";
import { formatDate, formatMoney } from "@/lib/format";
import { issueReceipt, voidReceipt } from "../actions";

/** Issuing a Cash Purchase Receipt: a preview of what it will say, which can't be changed here. */
function IssueForm({ expense: e }: { expense: ExpenseDetail }) {
  return (
    <ActionForm
      action={issueReceipt}
      submit="Issue receipt"
      variant="brand"
      closeOnSuccess
      confirm={{
        title: "Issue this receipt?",
        description:
          "It's issued by the organisation and numbered. It can't be edited afterwards, only voided and reissued.",
      }}
    >
      {(state) => (
        <>
          <input type="hidden" name="lineId" value={e.id} />
          <input type="hidden" name="lock" value={e.lock_version} />
          <Notice>
            <strong>Cash Purchase Receipt</strong>, issued internally because the seller gave none.
            The seller, amounts and date come from the expense. To correct them, return the expense
            instead.
          </Notice>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted text-xs">Seller</dt>
              <dd>{e.seller}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Date of purchase</dt>
              <dd>{e.date ? formatDate(e.date) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Total</dt>
              <dd className="font-semibold">{formatMoney(e.total_minor, e.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Seller&apos;s phone</dt>
              <dd>{e.phone || "Left blank"}</dd>
            </div>
          </dl>
          <TextArea
            label="What was bought"
            name="description"
            maxLength={200}
            defaultValue={e.description}
            hint="You can make this clearer. Everything else is fixed."
            errors={state.fieldErrors?.description}
          />
        </>
      )}
    </ActionForm>
  );
}

/** The Cash Purchase Receipts issued for an expense with no seller's receipt. */
export function ReceiptCard({ expense: e, base }: { expense: ExpenseDetail; base: string }) {
  if (!e.receipts.length && !e.can_issue_receipt) return null;
  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="font-semibold">Cash Purchase Receipt</h2>
        <p className="text-muted mt-1 text-sm">
          Issued by the organisation when the seller gave no receipt.
        </p>
      </div>
      {e.receipts.length > 0 && (
        <ul className="divide-line divide-y text-sm">
          {e.receipts.map((r) => (
            <li key={r.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className={r.status === "voided" ? "line-through" : "font-medium"}>
                  {r.number}
                </span>
                <Badge tone={r.status === "voided" ? "alert" : "solid"}>
                  {r.status === "voided" ? "Voided" : "Issued"}
                </Badge>
              </div>
              <p className="text-muted text-xs">
                By {r.issued_by} on {formatDate(r.issued_at)}
                {r.void_reason && ` · Voided: ${r.void_reason}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`${base}/receipts/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  <FileText className="size-4" aria-hidden />
                  Open PDF
                </a>
                <a
                  href={`/verify/${r.verify_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonStyles({ variant: "ghost", size: "sm" })}
                >
                  <QrCode className="size-4" aria-hidden />
                  Check page
                </a>
                {e.can_void_receipt && r.status === "issued" && (
                  <FormDialog
                    label="Void"
                    ariaLabel={`Void ${r.number}`}
                    title={`Void ${r.number}`}
                    description="Use this if something on it is wrong. You can then issue a new one."
                    variant="outline"
                    size="sm"
                  >
                    <ActionForm
                      action={voidReceipt}
                      submit="Void receipt"
                      variant="danger"
                      closeOnSuccess
                    >
                      {(state) => (
                        <>
                          <input type="hidden" name="id" value={r.id} />
                          <TextArea
                            label="Reason"
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
            </li>
          ))}
        </ul>
      )}
      {e.can_issue_receipt && (
        <FormDialog label="Issue receipt" title="Issue a Cash Purchase Receipt" variant="brand">
          <IssueForm expense={e} />
        </FormDialog>
      )}
    </Card>
  );
}
