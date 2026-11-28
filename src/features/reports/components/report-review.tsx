"use client";

import { CircleCheck, CircleHelp, MessageCircle } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Chat } from "@/components/ui/chat";
import { TextArea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Notice } from "@/components/ui/surface";
import type { Thread } from "@/features/conversations/schema";
import { cn } from "@/lib/utils";
import { resolveLineQuestion, reviewReport, sendLineMessage } from "../actions";
import type { ReportDetail } from "../schema";

const LABEL = { open: "Question", answered: "Answered", resolved: "Resolved" } as const;

/** A line's conversation, opened from its row. Reviewers start one; the department answers. */
export function LineConversation({
  line,
  canReview,
}: {
  line: { id: string; description: string; thread: Thread | null; can_message: boolean };
  canReview: boolean;
}) {
  const t = line.thread;
  if (!t && !(canReview && line.can_message)) return null;
  const Icon = !t ? MessageCircle : t.status === "resolved" ? CircleCheck : CircleHelp;
  return (
    <FormDialog
      label={
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" aria-hidden />
          {t ? `${LABEL[t.status]} (${t.messages.length})` : "Ask"}
        </span>
      }
      ariaLabel={t ? `Conversation about ${line.description}` : `Ask about ${line.description}`}
      title={line.description}
      description="Questions and answers about this expense."
      variant="outline"
      size="sm"
    >
      <Chat
        messages={t?.messages ?? []}
        send={sendLineMessage}
        fields={{ line: line.id }}
        canSend={line.can_message}
        empty="Ask the department about this expense. They'll be told."
        placeholder={canReview ? "Ask a question" : "Write your answer"}
      />
      {canReview && t && t.status !== "resolved" && (
        <div className="border-line mt-6 border-t pt-5">
          <p className="text-muted mb-3 text-sm">
            {t.status === "answered"
              ? "Happy with the answer? Resolve it so the report can be approved."
              : "Still waiting for an answer."}
          </p>
          <ActionForm
            action={resolveLineQuestion}
            submit="Mark as resolved"
            variant="outline"
            size="sm"
          >
            {() => <input type="hidden" name="line" value={line.id} />}
          </ActionForm>
        </div>
      )}
    </FormDialog>
  );
}

export function LineStatus({ thread }: { thread: Thread | null }) {
  if (!thread || thread.status === "resolved") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        thread.status === "open" ? "bg-brand-soft text-brand-strong" : "bg-ink/[0.06]",
      )}
    >
      {thread.status === "open" ? "Waiting for an answer" : "Answered"}
    </span>
  );
}

/** Approve or return. Open questions block approval; missing receipts need a note. */
export function ReviewPanel({ report: r }: { report: ReportDetail }) {
  const missing = r.lines.filter((l) => l.evidence === "missing").length;
  return (
    <div className="space-y-5">
      {r.open_questions > 0 && (
        <Notice tone="alert">
          {r.open_questions} {r.open_questions === 1 ? "question is" : "questions are"} still open.
          Resolve {r.open_questions === 1 ? "it" : "them"} before approving.
        </Notice>
      )}
      <ActionForm
        action={reviewReport}
        submit="Approve report"
        variant="brand"
        fullWidth
        className="space-y-4"
        confirm={{
          title: "Approve this report?",
          description: "Its expenses will be locked and can't change afterwards.",
        }}
      >
        {(state) => (
          <>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="lock" value={r.lock_version} />
            <input type="hidden" name="decision" value="approve" />
            <TextArea
              label={missing > 0 ? "Note for the record" : "Note for the record (optional)"}
              name="reason"
              maxLength={1000}
              hint={
                missing > 0
                  ? `${missing} without a receipt. Say why you accept ${missing === 1 ? "it" : "them"}.`
                  : undefined
              }
              errors={state.fieldErrors?.reason}
            />
          </>
        )}
      </ActionForm>
      <FormDialog
        label="Return to the department"
        title="Return this report"
        description="The head can change it and send it again."
        variant="outline"
      >
        <ActionForm action={reviewReport} submit="Return report" variant="danger" closeOnSuccess>
          {(state) => (
            <>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="lock" value={r.lock_version} />
              <input type="hidden" name="decision" value="return" />
              <TextArea
                label="What needs to change?"
                name="reason"
                maxLength={1000}
                errors={state.fieldErrors?.reason}
              />
            </>
          )}
        </ActionForm>
      </FormDialog>
    </div>
  );
}
