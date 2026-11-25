"use client";

import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/field";
import { requestReset, resetPassword, signIn } from "../actions";

export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} submit="Sign in" fullWidth>
      {(state) => (
        <>
          <input type="hidden" name="next" value={next ?? ""} />
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            errors={state.fieldErrors?.email}
          />
          <div>
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              errors={state.fieldErrors?.password}
            />
            <Link
              href="/forgot-password"
              className="text-muted hover:text-ink mt-2 inline-block text-sm"
            >
              Forgot password?
            </Link>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={requestReset} submit="Send reset link" fullWidth>
      {(state) => (
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          errors={state.fieldErrors?.email}
        />
      )}
    </ActionForm>
  );
}

export function ResetForm() {
  return (
    <ActionForm action={resetPassword} submit="Save password" fullWidth>
      {(state) => (
        <>
          <TextField
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters."
            errors={state.fieldErrors?.password}
          />
          <TextField
            label="Confirm password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            errors={state.fieldErrors?.confirm}
          />
        </>
      )}
    </ActionForm>
  );
}
