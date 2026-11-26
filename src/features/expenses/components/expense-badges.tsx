import { Badge } from "@/components/ui/surface";
import { FLAGS, STATUSES, type ExpenseFlag, type ExpenseStatus } from "../schema";

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
