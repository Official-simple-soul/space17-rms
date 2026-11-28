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
      return `${actor} sent a message about ${item}`;
    case "item_handed_over":
      return `${actor} handed you ${item}. Tap to confirm you've got it.`;
    case "item_received":
      return `${actor} confirmed receiving ${item}`;
    case "request_question":
      return `${actor} asked you a question about ${item}`;
    case "report_approved":
      return `${actor} approved the expense report: ${item}`;
    case "report_returned":
      return `${actor} returned the expense report: ${item}`;
    case "line_question":
      return `${actor} asked about "${p.line ?? "an expense"}" in ${item}`;
    case "line_answered":
      return `${actor} answered about "${p.line ?? "an expense"}" in ${item}`;
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
    case "expense_submitted":
      return `${p.requester ?? "Someone"} submitted an expense: ${item}`;
    case "expense_returned":
      return `${actor} returned your expense: ${item}`;
    case "expense_rejected":
      return `${actor} rejected your expense: ${item}`;
    case "report_submitted":
      return `${actor} submitted an expense report: ${item}`;
    case "report_due_soon":
      return `Expense report due soon: ${item}`;
    case "report_due_today":
      return `Expense report due today: ${item}`;
    case "report_late":
      return `Expense report is late: ${item}`;
    default:
      return item || "You have a new notification.";
  }
}

type Subject = { request_id: string | null; expense_id: string | null; report_id: string | null };

export function notificationPath(base: string, type: string, subject: Subject): string {
  if (subject.request_id)
    return `${base}/requests/${subject.request_id}${type === "request_question" || type === "request_comment" ? "#conversation" : ""}`;
  if (subject.expense_id) return `${base}/expenses/${subject.expense_id}`;
  if (subject.report_id) return `${base}/reports/${subject.report_id}`;
  if (type.startsWith("report_")) return `${base}/reports`;
  if (type === "bank_details_changed") return `${base}/bank-details`;
  if (type === "join_request") return `${base}/members?tab=requests`;
  return `${base}/notifications`;
}
