import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { EVIDENCE, FLAGS, STATUSES, type ExpenseFlag, type ExpenseStatus } from "../schema";

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const tone =
    status === "returned" || status === "rejected"
      ? "alert"
      : status === "accepted" || status === "locked"
        ? "solid"
        : "neutral";
  return <Badge tone={tone}>{STATUSES[status]}</Badge>;
}

export function ExpenseFlags({ flags }: { flags: ExpenseFlag[] }) {
  if (!flags.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <Badge key={f} tone="alert">
          {FLAGS[f]}
        </Badge>
      ))}
    </span>
  );
}

/** Whether the seller's receipt is attached. Compact shows only the icon on small screens. */
export function ReceiptStatus({
  evidence,
  draft = false,
  compact = false,
}: {
  evidence: keyof typeof EVIDENCE;
  draft?: boolean;
  compact?: boolean;
}) {
  // Our own Cash Purchase Receipt counts, just as a seller's receipt does.
  const has = evidence !== "missing";
  // While drafting, a missing receipt can still be added, so it isn't a warning yet.
  const label = has ? EVIDENCE[evidence] : draft ? "None yet" : EVIDENCE.missing;
  const Icon = has ? CircleCheck : draft ? CircleDashed : CircleAlert;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 text-xs font-medium whitespace-nowrap",
        compact ? "px-1.5 sm:px-2.5" : "px-2.5",
        has
          ? "bg-ink/[0.06] text-neutral-700"
          : draft
            ? "text-muted bg-ink/[0.04]"
            : "bg-brand-soft text-brand-strong",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className={cn(compact && "sr-only sm:not-sr-only sm:whitespace-nowrap")}>{label}</span>
    </span>
  );
}
