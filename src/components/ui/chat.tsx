"use client";

import { CircleHelp, MessagesSquare, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export type ChatMessage = {
  id: number;
  author: string;
  title: string | null;
  mine: boolean;
  body: string;
  question: boolean;
  at: string;
};

type Props = {
  messages: ChatMessage[];
  send: (state: ActionState, data: FormData) => Promise<ActionState>;
  /** Hidden values the action needs, such as the subject's id. */
  fields: Record<string, string>;
  canSend: boolean;
  /** Offers to send as a question that waits for an answer, worded for this subject. */
  askLabel?: string;
  empty: string;
  placeholder?: string;
};

const REFRESH = 15_000;

/** A conversation: others on the left, you on the right. New messages appear while the page is open. */
export function Chat({ messages, send, fields, canSend, askLabel, empty, placeholder }: Props) {
  const router = useRouter();
  const id = useId();
  const list = useRef<HTMLOListElement>(null);
  // Typed text is kept in state, so refreshing for new messages never clears it.
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [, action, pending] = useActionState(async (previous: ActionState, data: FormData) => {
    try {
      const result = await send(previous, data);
      if (result.ok) {
        setDraft("");
        setAsking(false);
        toast.success(result.message ?? "Sent.");
      } else {
        toast.error(result.message ?? result.fieldErrors?.body?.[0] ?? "Your message wasn't sent.");
      }
      return result;
    } catch {
      toast.error("Your message wasn't sent. Check your connection and try again.");
      return {};
    }
  }, {});

  useEffect(() => {
    if (!canSend) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH);
    return () => clearInterval(timer);
  }, [canSend, router]);

  // Keeps the newest message in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="text-muted flex items-center gap-3 rounded-xl bg-white/50 p-4 text-sm">
          <MessagesSquare className="size-5 shrink-0" aria-hidden />
          {empty}
        </div>
      ) : (
        <ol
          ref={list}
          aria-label="Messages"
          className="-mx-1 max-h-[28rem] space-y-4 overflow-y-auto px-1 py-1"
        >
          {messages.map((m) => (
            <li key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
              <span className="text-muted mb-1 px-1 text-xs">
                <span className="text-ink font-medium">{m.mine ? "You" : m.author}</span>
                {m.title && !m.mine && ` · ${m.title}`} · {formatDateTime(m.at)}
              </span>
              <div
                className={cn(
                  "animate-rise max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line",
                  m.mine
                    ? "bg-ink rounded-br-md text-white shadow-[0_6px_16px_-8px_rgb(10_10_10/0.5)]"
                    : "rounded-bl-md border border-white bg-white/85 shadow-[0_4px_14px_-8px_rgb(60_10_15/0.25)]",
                  m.question && !m.mine && "ring-brand/25 ring-2",
                )}
              >
                {m.question && (
                  <span
                    className={cn(
                      "mb-1 flex items-center gap-1 text-xs font-semibold",
                      m.mine ? "text-white/75" : "text-brand",
                    )}
                  >
                    <CircleHelp className="size-3.5" aria-hidden />
                    Question
                  </span>
                )}
                {m.body}
              </div>
            </li>
          ))}
        </ol>
      )}
      {canSend && (
        <form action={action} className="space-y-3">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <label htmlFor={id} className="sr-only">
            Your message
          </label>
          <div className="focus-within:border-brand/50 focus-within:ring-brand/10 border-ink/10 flex items-end gap-2 rounded-2xl border bg-white/80 p-2 transition focus-within:ring-4">
            <textarea
              id={id}
              name="body"
              rows={2}
              maxLength={2000}
              required
              value={draft}
              placeholder={placeholder ?? "Write a message"}
              onChange={(e) => setDraft(e.target.value)}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-neutral-400 sm:text-sm"
            />
            <Button
              type="submit"
              variant="brand"
              size="icon"
              loading={pending}
              disabled={!draft.trim()}
              aria-label={asking ? "Send question" : "Send"}
              className="rounded-xl"
            >
              {!pending && <SendHorizontal className="size-4" aria-hidden />}
            </Button>
          </div>
          {askLabel && (
            <label className="text-muted flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="question"
                checked={asking}
                onChange={(e) => setAsking(e.target.checked)}
                className="accent-brand size-4"
              />
              {askLabel}
            </label>
          )}
        </form>
      )}
    </div>
  );
}
