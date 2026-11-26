import { Badge } from "@/components/ui/surface";
import { STATUSES, type ReportStatus } from "../schema";

export function ReportStatusBadge({
  status,
  overdue,
}: {
  status: ReportStatus | null;
  overdue?: boolean;
}) {
  if (overdue)
    return <Badge tone="alert">{status === "returned" ? "Returned, late" : "Late"}</Badge>;
  if (!status) return <Badge>Not started</Badge>;
  return (
    <Badge tone={status === "returned" ? "alert" : status === "draft" ? "neutral" : "solid"}>
      {STATUSES[status]}
    </Badge>
  );
}
