"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField, TextArea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { FileUploader } from "@/features/files/components/file-uploader";
import { formatMoney } from "@/lib/format";
import {
  acceptReady,
  decideExpense,
  deleteExpense,
  removeFromReport,
  startExpenseFile,
  withdrawExpense,
} from "../actions";
import { PROOF, type ExpenseDetail, type FileKind } from "../schema";

const DECISIONS = {
  accept: { label: "Accept", submit: "Accept expense", title: "Accept this expense?" },
  return: { label: "Return for changes", submit: "Return expense", title: "Return this expense?" },
  reject: { label: "Reject", submit: "Reject expense", title: "Reject this expense?" },
} as const;
type Decision = keyof typeof DECISIONS;

export function DecideExpense({ expense: e }: { expense: ExpenseDetail }) {
  const [decision, setDecision] = useState<Decision>("accept");
  const chosen = DECISIONS[decision];
  return (
    <ActionForm
      action={decideExpense}
      submit={chosen.submit}
      variant="brand"
      fullWidth
      closeOnSuccess
      confirm={{
        title: chosen.title,
        description:
          decision === "reject"
            ? "This is final. It can't be submitted again."
            : `${e.description}, ${formatMoney(e.total_minor, e.currency)}`,
      }}
    >
      {(state) => (
        <>
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="lock" value={e.lock_version} />
          <SelectField
            label="Decision"
            name="decision"
            value={decision}
            onChange={(event) => setDecision(event.target.value as Decision)}
          >
            {Object.entries(DECISIONS).map(([value, d]) => (
              <option key={value} value={value}>
                {d.label}
              </option>
            ))}
          </SelectField>
          {decision !== "accept" && (
            <TextArea
              label="Reason"
              name="reason"
              maxLength={1000}
              errors={state.fieldErrors?.reason}
            />
          )}
        </>
      )}
    </ActionForm>
  );
}

/** Accepts exactly the lines shown; anything that changed since stops the whole batch. */
export function AcceptReady({
  orgId,
  lines,
  currency,
}: {
  orgId: string;
  lines: { id: string; lock_version: number; total_minor: number }[];
  currency: string;
}) {
  const total = lines.reduce((sum, l) => sum + l.total_minor, 0);
  const what = `${lines.length} ${lines.length === 1 ? "expense" : "expenses"}`;
  return (
    <ActionForm
      action={acceptReady}
      submit={`Accept ${lines.length} ready`}
      variant="outline"
      className="space-y-2"
      closeOnSuccess
      confirm={{
        title: `Accept ${what}?`,
        description: `${formatMoney(total, currency)} in total. Each has a receipt and no flags.`,
      }}
    >
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input
            type="hidden"
            name="lines"
            value={JSON.stringify(lines.map(({ id, lock_version }) => ({ id, lock_version })))}
          />
        </>
      )}
    </ActionForm>
  );
}

export function RemoveFromReport({ expense: e }: { expense: ExpenseDetail }) {
  return (
    <FormDialog
      label="Take out of report"
      title="Take out of report"
      description={`It goes back to ${e.by} to correct.`}
      variant="outline"
    >
      <ActionForm
        action={removeFromReport}
        submit="Take out and return"
        variant="brand"
        closeOnSuccess
      >
        {(state) => (
          <>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="lock" value={e.lock_version} />
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

export function WithdrawExpense({ expense: e }: { expense: ExpenseDetail }) {
  return (
    <ActionForm
      action={withdrawExpense}
      submit="Withdraw"
      variant="outline"
      className="space-y-2"
      closeOnSuccess
      confirm={{
        title: "Withdraw this expense?",
        description: "It stays in your history but can't be submitted again.",
      }}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={e.id} />
          <input type="hidden" name="lock" value={e.lock_version} />
        </>
      )}
    </ActionForm>
  );
}

export function DeleteExpense({ id, slug }: { id: string; slug: string }) {
  return (
    <ActionForm
      action={deleteExpense}
      submit="Delete draft"
      variant="outline"
      className="space-y-2"
      confirm={{ title: "Delete this draft?", description: "Its files are deleted too." }}
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

/** For accepted expenses whose receipt turned up later. */
export function AddEvidence({ expense: e }: { expense: ExpenseDetail }) {
  const router = useRouter();
  const [kind, setKind] = useState<FileKind>("vendor_receipt");
  return (
    <div className="space-y-4">
      <SelectField
        label="Type of evidence"
        name="kind"
        value={kind}
        onChange={(event) => setKind(event.target.value as FileKind)}
      >
        {Object.entries({ vendor_receipt: "Receipt", ...PROOF }).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <FileUploader
        label="Add file"
        files={[]}
        onChange={() => router.refresh()}
        start={(file) => startExpenseFile({ ...file, expenseId: e.id, kind })}
      />
      <p className="text-muted text-xs">Files added now can&apos;t be removed.</p>
    </div>
  );
}
