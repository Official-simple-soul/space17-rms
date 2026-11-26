"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { CodeField } from "@/components/ui/code-field";
import { Notice } from "@/components/ui/surface";
import { startEnrolment, verifyCode } from "../actions";

export function CodeForm({ factorId, next }: { factorId: string; next?: string }) {
  return (
    <ActionForm action={verifyCode} submit="Verify" fullWidth>
      {(state) => (
        <>
          <input type="hidden" name="factorId" value={factorId} />
          <input type="hidden" name="next" value={next ?? ""} />
          <CodeField
            label="6-digit code"
            name="code"
            errors={state.fieldErrors?.code}
            rejection={!state.ok && (state.message || state.fieldErrors) ? state : undefined}
          />
        </>
      )}
    </ActionForm>
  );
}

export function EnrolPanel({ next }: { next?: string }) {
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string }>();
  const [error, setError] = useState<string>();

  if (!setup)
    return (
      <div className="space-y-4">
        {error && <Notice tone="alert">{error}</Notice>}
        <p className="text-muted text-sm">
          Use an authenticator app such as Google Authenticator or 1Password.
        </p>
        <Button
          className="w-full"
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await startEnrolment();
              if ("error" in result) setError(result.error);
              else setSetup(result);
            })
          }
        >
          Set up two-step verification
        </Button>
      </div>
    );

  return (
    <div className="space-y-5">
      <Image
        src={setup.qr}
        alt="QR code for your authenticator app"
        width={176}
        height={176}
        unoptimized
        className="rounded-control border-line border bg-white p-2"
      />
      <p className="text-muted text-xs">
        Can&apos;t scan it? Enter this key:{" "}
        <code className="text-ink font-mono break-all">{setup.secret}</code>
      </p>
      <CodeForm factorId={setup.factorId} next={next} />
    </div>
  );
}
