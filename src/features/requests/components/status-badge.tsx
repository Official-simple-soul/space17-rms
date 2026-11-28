import { Badge } from "@/components/ui/surface";
import { statusLabel, type Provision, type RequestStatus } from "../schema";

export function StatusBadge({
  status,
  provision,
}: {
  status: RequestStatus;
  provision?: Provision;
}) {
  const tone =
    status === "returned" || status === "rejected"
      ? "alert"
      : [
            "approved",
            "part_paid",
            "paid",
            "received",
            "accounted",
            "closed",
            "handed_over",
          ].includes(status)
        ? "solid"
        : "neutral";
  return <Badge tone={tone}>{statusLabel(status, provision)}</Badge>;
}
