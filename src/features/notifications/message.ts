import type { NotificationPayload } from "./schema";

export function notificationMessage(type: string, p: NotificationPayload): string {
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
    case "payment_recorded":
      return `A payment was recorded for ${item}. Confirm when you receive it.`;
    case "payment_voided":
      return `${actor} voided a payment for ${item}`;
    case "payment_confirmed":
      return `${actor} confirmed receiving a payment for ${item}`;
    case "bank_details_changed":
      return "Your bank details were changed. If this wasn't you, tell your admin now.";
    case "join_request":
      return `${p.requester ?? "Someone"} asked to join your organisation`;
    default:
      return item || "You have a new notification.";
  }
}

export function notificationPath(base: string, type: string, requestId: string | null): string {
  if (requestId) return `${base}/requests/${requestId}`;
  if (type === "bank_details_changed") return `${base}/bank-details`;
  if (type === "join_request") return `${base}/members?tab=requests`;
  return `${base}/notifications`;
}
