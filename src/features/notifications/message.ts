type Payload = {
  number?: string | null;
  title?: string;
  requester?: string;
  actor?: string | null;
};

export function notificationMessage(type: string, p: Payload): string {
  const item = [p.number, p.title].filter(Boolean).join(" ");
  const actor = p.actor ?? "Someone";
  switch (type) {
    case "approval_needed":
      return `${p.requester ?? "Someone"} needs your approval: ${item}`;
    case "request_approved":
      return `Your request was approved: ${item}`;
    case "request_returned":
      return `${actor} returned your request: ${item}`;
    case "request_rejected":
      return `${actor} rejected your request: ${item}`;
    case "request_comment":
      return `${actor} commented on ${item}`;
    default:
      return item || "You have a new notification.";
  }
}
