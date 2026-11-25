"use client";

import { AlertDialog } from "radix-ui";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { ConfirmDialog } from "./alert-dialog";
import { Button, buttonStyles } from "./button";
import { useCloseDialog } from "./form-dialog";
import { Notice } from "./surface";

type Action = (state: ActionState, data: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  submit: string;
  variant?: "primary" | "brand" | "outline" | "danger";
  className?: string;
  fullWidth?: boolean;
  /** Ask before submitting. */
  confirm?: { title: string; description?: string };
  /** Inside a side panel: close it and show the message as a toast. */
  closeOnSuccess?: boolean;
  /** Also announce failures as a toast, for forms a refresh may remove. */
  toastErrors?: boolean;
  size?: "sm" | "md";
  children?: (state: ActionState) => React.ReactNode;
};

/** Standard server-action form: pending state, errors and success message. */
export function ActionForm({
  action,
  submit,
  variant = "primary",
  className,
  fullWidth,
  confirm,
  closeOnSuccess,
  toastErrors,
  size,
  children,
}: Props) {
  const [state, dispatch, pending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await action(previous, data);
      // Announced here because the refreshed page may no longer contain this form.
      if (result.message && result.ok && closeOnSuccess) toast.success(result.message);
      if (result.message && !result.ok && toastErrors) toast.error(result.message);
      return result;
    },
    {},
  );
  const [held, setHeld] = useState<FormData | null>(null);
  const close = useCloseDialog();
  const handled = useRef(state);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (!state.ok || !closeOnSuccess) return;
    close?.();
  }, [state, close, closeOnSuccess]);
  const send = (data: FormData) => startTransition(() => dispatch(data));
  return (
    <form
      className={className ?? "space-y-5"}
      noValidate
      // Submitting manually keeps typed values when validation fails.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (confirm) setHeld(data);
        else send(data);
      }}
    >
      {state.message && <Notice tone={state.ok ? "neutral" : "alert"}>{state.message}</Notice>}
      {children?.(state)}
      <Button
        type="submit"
        variant={variant}
        size={size}
        loading={pending}
        className={fullWidth ? "w-full" : undefined}
      >
        {submit}
      </Button>
      {confirm && (
        <ConfirmDialog
          open={held !== null}
          onOpenChange={(open) => !open && setHeld(null)}
          {...confirm}
        >
          <AlertDialog.Action
            type="button"
            className={buttonStyles({ variant: "brand" })}
            onClick={() => held && send(held)}
          >
            {submit}
          </AlertDialog.Action>
        </ConfirmDialog>
      )}
    </form>
  );
}
