"use client";

import { useEffect } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { markAllRead, markSubjectRead } from "../actions";

/** Opening an item clears its notifications. Runs in the browser so prefetching never does. */
export function MarkRead({ orgId, subjectId }: { orgId: string; subjectId: string }) {
  useEffect(() => {
    markSubjectRead(orgId, subjectId).catch(() => {});
  }, [orgId, subjectId]);
  return null;
}

export function MarkAllRead({ orgId }: { orgId: string }) {
  return (
    <ActionForm
      action={markAllRead}
      submit="Mark all as read"
      variant="outline"
      className="space-y-2"
    >
      {() => <input type="hidden" name="orgId" value={orgId} />}
    </ActionForm>
  );
}
