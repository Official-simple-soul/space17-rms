"use client";

import { AlertDialog } from "radix-ui";
import { unstable_rethrow } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { ConfirmDialog } from "./alert-dialog";
import { Button, buttonStyles } from "./button";
import { useCloseDialog } from "./form-dialog";
import { Notice } from "./surface";
import { showFlash } from "./toaster";

type Action = (state: ActionState, data: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  submit: string;
  variant?: "primary" | "brand" | "outline" | "danger";
  className?: string;
  fullWidth?: boolean;
  /** Ask before submitting. */
  confirm?: { title: string; description?: string };
  /** Inside a side panel: close it. */
  closeOnSuccess?: boolean;
  /** Keep the success message on the page instead of a toast, when it must not disappear. */
  keepMessage?: boolean;
  /** Show only the message once it succeeds. */
  once?: boolean;
  size?: "sm" | "md";
  children?: (state: ActionState) => React.ReactNode;
};

/** Runs an action so that it always ends with a result to show, even if the connection drops. */
async function run(action: Action, previous: ActionState, data: FormData): Promise<ActionState> {
  try {
    return await action(previous, data);
  } catch (error) {
    showFlash();
    unstable_rethrow(error);
    return {
      message:
        "We couldn't confirm that worked. Check your connection and reload before trying again.",
    };
  }
}

/** Standard server-action form: pending state, errors, and a toast for every outcome. */
export function ActionForm({
  action,
  submit,
  variant = "primary",
  className,
  fullWidth,
  confirm,
  closeOnSuccess,
  keepMessage,
  once,
  size,
  children,
}: Props) {
  const keep = keepMessage || once;
  const form = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      const result = await run(action, previous, data);
      // Announced here because the refreshed page may no longer contain this form.
      if (!result) return {};
      if (result.ok) {
        if (result.message && !keep) toast.success(result.message);
      } else if (result.message) toast.error(result.message, { duration: 8000 });
      else if (result.fieldErrors) toast.error("Check the highlighted fields.");
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
    if (state.ok && closeOnSuccess) close?.();
    if (state.fieldErrors)
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state, close, closeOnSuccess]);
  const send = (data: FormData) => startTransition(() => dispatch(data));
  return (
    <form
      ref={form}
      // Only used before the page is ready: keeps passwords out of the address bar.
      method="post"
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
      {state.message && (!state.ok || keep) && (
        <Notice tone={state.ok ? "neutral" : "alert"}>{state.message}</Notice>
      )}
      {!(once && state.ok) && children?.(state)}
      <Button
        type="submit"
        variant={variant}
        size={size}
        loading={pending}
        className={once && state.ok ? "hidden" : fullWidth ? "w-full" : undefined}
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
