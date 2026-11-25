"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Badge, Card, Notice } from "@/components/ui/surface";
import { FileUploader } from "@/features/requests/components/file-uploader";
import { Files } from "@/features/requests/components/request-details";
import type { RequestDetail } from "@/features/requests/schema";
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import {
  confirmPayment,
  recordPayment,
  revealBankAccount,
  startProof,
  voidPayment,
} from "../actions";
import { METHODS } from "../schema";

type Payment = RequestDetail["payments"][number];

function RecordForm({ request: r, today }: { request: RequestDetail; today: string }) {
  const balance = (r.approved_minor ?? 0) - r.paid_minor;
  const [amount, setAmount] = useState((balance / 100).toFixed(2));
  const [payee, setPayee] = useState("requester");
  const minor = parseMoney(amount) ?? 0;
  return (
    <ActionForm
      action={recordPayment}
      submit="Record payment"
      variant="brand"
      closeOnSuccess
      toastErrors
      confirm={{
        title: `Record ${formatMoney(minor, r.currency)}?`,
        description: "This records a payment already made. It doesn't move money.",
      }}
    >
      {(state) => (
        <>
          <input type="hidden" name="requestId" value={r.id} />
          <input type="hidden" name="lock" value={r.lock_version} />
          <TextField
            label={`Amount, ${r.currency}`}
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Balance: ${formatMoney(balance, r.currency)}`}
            errors={
              minor > balance
                ? [`Can't be more than ${formatMoney(balance, r.currency)}.`]
                : state.fieldErrors?.amount
            }
          />
          <SelectField
            label="Paid to"
            name="payee"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
          >
            <option value="requester">{r.requester}</option>
            <option value="other">Someone else</option>
          </SelectField>
          {payee === "other" && (
            <TextField
              label="Name of person or business paid"
              name="payeeName"
              maxLength={120}
              errors={state.fieldErrors?.payeeName}
            />
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Date paid"
              name="paidOn"
              type="date"
              defaultValue={today}
              max={today}
              errors={state.fieldErrors?.paidOn}
            />
            <SelectField label="Method" name="method" defaultValue="bank_transfer">
              {Object.entries(METHODS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField label="Reference (optional)" name="reference" maxLength={80} />
          <TextArea label="Note (optional)" name="note" maxLength={500} />
          <p className="text-muted text-xs">You can add proof after recording.</p>
        </>
      )}
    </ActionForm>
  );
}

function BankDetails({ request: r }: { request: RequestDetail }) {
  const [number, setNumber] = useState("");
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState(false);
  if (!r.bank) return <Notice>{r.requester} hasn&apos;t added bank details.</Notice>;
  async function reveal() {
    setPending(true);
    setProblem("");
    try {
      const result = await revealBankAccount(r.id);
      if ("number" in result) setNumber(result.number);
      else setProblem(result.message);
    } catch {
      setProblem("Couldn't load the details. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="rounded-control border-line border p-4 text-sm">
      <p className="text-muted text-xs">{r.requester}&apos;s bank details</p>
      <p className="mt-1 font-medium">{r.bank.account_name}</p>
      <p>{r.bank.bank_name}</p>
      <p className="mt-1 font-mono" data-testid="account-number">
        {number || `•••• ${r.bank.last_digits}`}
      </p>
      <p className="text-muted mt-1 text-xs">Last changed {formatDate(r.bank.updated_at)}</p>
      {problem && (
        <p role="alert" className="text-brand-strong mt-2 text-xs font-medium">
          {problem}
        </p>
      )}
      {!number && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            loading={pending}
            onClick={reveal}
          >
            <Eye className="size-4" aria-hidden />
            Reveal number
          </Button>
          <p className="text-muted mt-2 text-xs">Each reveal is recorded.</p>
        </>
      )}
    </div>
  );
}

function PaymentItem({
  payment: p,
  request: r,
  filesBase,
}: {
  payment: Payment;
  request: RequestDetail;
  filesBase: string;
}) {
  const router = useRouter();
  const voided = p.status === "voided";
  return (
    <li className="space-y-3 py-4 text-sm first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-semibold tabular-nums ${voided ? "line-through" : ""}`}>
            {formatMoney(p.amount_minor, r.currency)}
          </p>
          <p className="text-muted text-xs">
            {p.number} · {formatDate(p.paid_on)} · {METHODS[p.method]}
          </p>
        </div>
        <Badge tone={voided ? "alert" : p.confirmed_at ? "solid" : "neutral"}>
          {voided ? "Voided" : p.confirmed_at ? "Confirmed" : "Not confirmed"}
        </Badge>
      </div>
      <p className="text-xs">
        To {p.payee}, recorded by {p.recorded_by}
        {p.reference && ` · Ref ${p.reference}`}
      </p>
      {p.note && <p className="text-xs whitespace-pre-wrap">{p.note}</p>}
      {p.void_reason && <p className="text-brand-strong text-xs">Voided: {p.void_reason}</p>}
      {!p.can_add_proof && p.proofs.length > 0 && <Files files={p.proofs} base={filesBase} />}
      {p.can_add_proof && (
        <>
          {p.proofs.length > 0 && <Files files={p.proofs} base={filesBase} />}
          {p.proofs.length < 5 && (
            <FileUploader
              label="Add proof"
              files={[]}
              start={(file) =>
                startProof({
                  paymentId: p.id,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                })
              }
              onChange={() => router.refresh()}
            />
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {r.is_requester && !voided && !p.confirmed_at && (
          <ActionForm
            action={confirmPayment}
            submit="I received this"
            variant="brand"
            size="sm"
            className="space-y-2"
            closeOnSuccess
            toastErrors
            confirm={{
              title: "Confirm this payment?",
              description: `You're confirming ${formatMoney(p.amount_minor, r.currency)} was received.`,
            }}
          >
            {() => <input type="hidden" name="id" value={p.id} />}
          </ActionForm>
        )}
        {r.can_void && !voided && (
          <FormDialog
            label="Void"
            ariaLabel={`Void ${p.number}`}
            title={`Void ${p.number}`}
            description="Use this when a payment failed or was recorded by mistake. The balance becomes due again."
            variant="outline"
            size="sm"
          >
            <ActionForm
              action={voidPayment}
              submit="Void payment"
              variant="brand"
              closeOnSuccess
              toastErrors
            >
              {(state) => (
                <>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="lock" value={r.lock_version} />
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
  );
}

export function PaymentsCard({
  request: r,
  filesBase,
  today,
}: {
  request: RequestDetail;
  filesBase: string;
  today: string;
}) {
  const approved = r.approved_minor ?? 0;
  if (
    !approved ||
    !["approved", "part_paid", "paid", "received", "accounted", "closed"].includes(r.status)
  )
    return null;
  return (
    <Card className="space-y-5 p-6">
      <h2 className="font-semibold">Payment</h2>
      <dl className="space-y-1.5 text-sm">
        {(
          [
            ["Approved", approved],
            ["Paid", r.paid_minor],
            ["Balance", approved - r.paid_minor],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 last:font-semibold">
            <dt>{label}</dt>
            <dd className="tabular-nums">{formatMoney(value, r.currency)}</dd>
          </div>
        ))}
      </dl>
      {r.can_pay && (
        <>
          <BankDetails request={r} />
          <FormDialog
            label="Record payment"
            title={`Record payment for ${r.number}`}
            variant="brand"
          >
            <RecordForm request={r} today={today} />
          </FormDialog>
        </>
      )}
      {r.payments.length > 0 && (
        <ul className="divide-line border-line divide-y border-t pt-4">
          {r.payments.map((p) => (
            <PaymentItem key={p.id} payment={p} request={r} filesBase={filesBase} />
          ))}
        </ul>
      )}
    </Card>
  );
}
