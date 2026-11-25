import { Badge } from "@/components/ui/surface";
import { STATUSES, type RequestStatus } from "../schema";

export function StatusBadge({ status }: { status: RequestStatus }) {
  const tone =
    status === "returned" || status === "rejected"
      ? "alert"
      : ["approved", "part_paid", "paid", "received", "accounted", "closed"].includes(status)
        ? "solid"
        : "neutral";
  return <Badge tone={tone}>{STATUSES[status]}</Badge>;
}
