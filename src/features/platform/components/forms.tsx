"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { changeStatus, declineRequest, inviteOrganisation, revokeInvite } from "../actions";

export function InviteForm() {
  return (
    <ActionForm action={inviteOrganisation} submit="Create invitation" variant="brand">
      {(state) => (
        <>
          {state.data?.link && (
            <div className="rounded-control border-line flex items-center gap-2 border p-2 pl-3">
              <code className="min-w-0 flex-1 truncate text-xs" data-testid="invite-link">
                {state.data.link}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.data!.link);
                  toast.success("Link copied");
                }}
              >
                <Copy className="size-4" aria-hidden />
                Copy
              </Button>
            </div>
          )}
          <TextField
            label="Organisation admin's email"
            name="email"
            type="email"
            hint="The link works once, for this email only, for 7 days."
            errors={state.fieldErrors?.email}
          />
        </>
      )}
    </ActionForm>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  return (
    <ActionForm
      action={revokeInvite}
      size="sm"
      submit="Revoke"
      variant="outline"
      className="space-y-2"
      confirm="Revoke this invitation?"
    >
      {() => <input type="hidden" name="id" value={id} />}
    </ActionForm>
  );
}

export function DeclineRequest({ id }: { id: string }) {
  return (
    <ActionForm
      action={declineRequest}
      size="sm"
      submit="Decline"
      variant="outline"
      className="space-y-2"
      confirm="Decline this request?"
    >
      {() => <input type="hidden" name="id" value={id} />}
    </ActionForm>
  );
}

export function StatusForm({ id, suspended }: { id: string; suspended: boolean }) {
  return (
    <ActionForm
      action={changeStatus}
      closeOnSuccess
      submit={suspended ? "Reactivate" : "Suspend"}
      variant={suspended ? "outline" : "danger"}
      className="mt-4 space-y-3"
      confirm={
        suspended
          ? "Reactivate this organisation?"
          : "Suspend this organisation? Members will lose access immediately."
      }
    >
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="suspended" value={String(!suspended)} />
          <TextField label="Reason" name="reason" />
        </>
      )}
    </ActionForm>
  );
}
