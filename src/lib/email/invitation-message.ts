import "server-only";
import { usesTestInbox } from "./provider";

/** What to tell the sender, without claiming a local test email reached anyone. */
export function invitationMessage(sent: boolean) {
  if (!sent) return "Invitation created. Copy the link now; it won't be shown again.";
  return usesTestInbox()
    ? "Invitation created. Its email went to the local test inbox, not to the person. Copy the link now; it won't be shown again."
    : "Invitation emailed. You can also copy the link now; it won't be shown again.";
}
