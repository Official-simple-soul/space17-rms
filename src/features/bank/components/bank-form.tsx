"use client";

import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/field";
import { removeBankAccount, saveBankAccount } from "../actions";

export function BankForm({
  orgId,
  account,
}: {
  orgId: string;
  account?: { bank_name: string; account_name: string; updated_at: string };
}) {
  return (
    <ActionForm
      // Saving remounts the form, so the typed number doesn't stay on screen.
      key={account?.updated_at}
      action={saveBankAccount}
      submit={account ? "Replace details" : "Save details"}
      closeOnSuccess
    >
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <TextField
            label="Bank"
            name="bank"
            maxLength={80}
            defaultValue={account?.bank_name}
            errors={state.fieldErrors?.bank}
          />
          <TextField
            label="Account name"
            name="name"
            maxLength={120}
            defaultValue={account?.account_name}
            errors={state.fieldErrors?.name}
          />
          <TextField
            label="Account number"
            name="number"
            inputMode="numeric"
            autoComplete="off"
            maxLength={40}
            errors={state.fieldErrors?.number}
          />
        </>
      )}
    </ActionForm>
  );
}

export function RemoveBankAccount({ orgId }: { orgId: string }) {
  return (
    <ActionForm
      action={removeBankAccount}
      submit="Remove details"
      variant="danger"
      className="space-y-3"
      closeOnSuccess
      confirm={{ title: "Remove your bank details?" }}
    >
      {() => <input type="hidden" name="orgId" value={orgId} />}
    </ActionForm>
  );
}
