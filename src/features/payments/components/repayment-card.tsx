"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Card, Notice } from "@/components/ui/surface";
import type { ExpenseDetail } from "@/features/expenses/schema";
import { formatDate, formatMoney, parseMoney } from "@/lib/format";
import {
  confirmRepayment,
  recordRepayment,
  revealRepaymentAccount,
  voidRepayment,
} from "../actions";
import { METHODS } from "../schema";
import { PaymentItem } from "./payments-card";

type Bank = { bank_name: string; account_name: string; last_digits: string; updated_at: string };

function RepayBank({ lineId, payee, bank }: { lineId: string; payee: string; bank: Bank | null }) {
  const [number, setNumber] = useState("");
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState(false);
  if (!bank)
    return (
      <Notice>{payee} hasn&apos;t added bank details. Pay in cash, or ask them to add them.</Notice>
    );
  async function reveal() {
    setPending(true);
    setProblem("");
    try {
      const result = await revealRepaymentAccount(lineId);
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
      <p className="text-muted text-xs">{payee}&apos;s bank details</p>
      <p className="mt-1 font-medium">{bank.account_name}</p>
      <p>{bank.bank_name}</p>
      <p className="mt-1 font-mono">{number || `•••• ${bank.last_digits}`}</p>
      <p className="text-muted mt-1 text-xs">Last changed {formatDate(bank.updated_at)}</p>
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

function RecordRepayment({
  expense: e,
  balance,
  today,
}: {
  expense: ExpenseDetail;
  balance: number;
  today: string;
}) {
  const [amount, setAmount] = useState((balance / 100).toFixed(2));
  const minor = parseMoney(amount) ?? 0;
  return (
    <ActionForm
      action={recordRepayment}
      submit="Record repayment"
      variant="brand"
      closeOnSuccess
      confirm={{
        title: `Record ${formatMoney(minor, e.currency)}?`,
        description: "This records a repayment already made. It doesn't move money.",
      }}
    >
      {(state) => (
        <>
          <input type="hidden" name="lineId" value={e.id} />
          <input type="hidden" name="lock" value={e.lock_version} />
          <TextField
            label={`Amount, ${e.currency}`}
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
            hint={`Still owed: ${formatMoney(balance, e.currency)}`}
            errors={
              minor > balance
                ? [`Can't be more than ${formatMoney(balance, e.currency)}.`]
                : state.fieldErrors?.amount
            }
          />
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

/** Paying someone back for an expense they paid with their own money. */
export function RepaymentCard({
  expense: e,
  bank,
  filesBase,
  today,
}: {
  expense: ExpenseDetail;
  bank: Bank | null;
  filesBase: string;
  today: string;
}) {
  const r = e.repayment;
  if (!r) return null;
  const balance = e.total_minor - r.repaid_minor;
  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="font-semibold">Paying back</h2>
        <p className="text-muted mt-1 text-sm">
          {r.is_payee ? "You paid with your own money." : `${r.payee} paid with their own money.`}
        </p>
      </div>
      <dl className="space-y-1.5 text-sm">
        {(
          [
            ["Spent", e.total_minor],
            ["Repaid", r.repaid_minor],
            ["Still owed", balance],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 last:font-semibold">
            <dt>{label}</dt>
            <dd className="tabular-nums">{formatMoney(value, e.currency)}</dd>
          </div>
        ))}
      </dl>
      {r.can_pay && (
        <>
          <RepayBank lineId={e.id} payee={r.payee} bank={bank} />
          <FormDialog label="Record repayment" title={`Repay ${r.payee}`} variant="brand">
            <RecordRepayment expense={e} balance={balance} today={today} />
          </FormDialog>
        </>
      )}
      {r.payments.length > 0 && (
        <ul className="divide-line border-line divide-y border-t pt-4">
          {r.payments.map((p) => (
            <PaymentItem
              key={p.id}
              payment={p}
              currency={e.currency}
              lock={e.lock_version}
              filesBase={filesBase}
              canConfirm={r.is_payee}
              canVoid={r.can_void && !p.confirmed_at}
              confirm={confirmRepayment}
              voidAction={voidRepayment}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
