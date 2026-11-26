"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { SaveStatus } from "@/lib/use-autosave";
import { Button } from "./button";
import { Notice } from "./surface";

/** One toast at a time, however often the same problem comes up. */
export const announceProblem = (message: string) =>
  void toast.error(message, { id: "form-problem", duration: 8000 });

/** Submit button, problems and save state for an autosaved form. */
export function SavePanel({
  submit,
  submitting,
  problem,
  status,
  dirty,
  onRetry,
}: {
  submit: string;
  submitting: boolean;
  problem: string;
  status: SaveStatus;
  dirty: boolean;
  onRetry: () => void;
}) {
  // The panel may be out of view, especially on phones.
  useEffect(() => {
    if (problem) announceProblem(problem);
  }, [problem]);
  return (
    <>
      {problem && <Notice tone="alert">{problem}</Notice>}
      {status === "stale" ? (
        <Button type="button" className="w-full" onClick={() => window.location.reload()}>
          Reload
        </Button>
      ) : (
        <Button type="submit" variant="brand" className="w-full" loading={submitting}>
          {submit}
        </Button>
      )}
      <div className="flex items-center justify-between gap-2 text-xs" aria-live="polite">
        <span className="text-muted">
          {status === "saving" ? "Saving…" : dirty ? "Not saved yet" : "Draft saved"}
        </span>
        {dirty && status === "failed" && (
          <button type="button" className="text-brand font-medium" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </>
  );
}
