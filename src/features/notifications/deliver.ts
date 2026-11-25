import "server-only";
import { after } from "next/server";
import { env } from "@/config/env";
import { getEmailProvider } from "@/lib/email/provider";
import { renderEmail } from "@/lib/email/template";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationMessage, notificationPath } from "./message";
import { notificationPayload } from "./schema";

const BATCH = 20;
const MAX_BATCHES = 5;

/** Sends what is due. Safe to run from several places at once: each email is claimed first. */
export async function deliverEmails() {
  const send = getEmailProvider();
  const result = { sent: 0, failed: 0 };
  if (!send) return result;
  const admin = createAdminClient();
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await admin.rpc("claim_emails", { p_limit: BATCH });
    if (error) throw new Error("Could not read the email queue");
    for (const item of data) {
      const message = notificationMessage(item.type, notificationPayload(item.payload));
      const email = renderEmail({
        subject: message,
        heading: message,
        lines: [`Hello ${item.name}, there's an update for you in ${item.org_name}.`],
        action: {
          label: "Open",
          url: env.appUrl + notificationPath(`/o/${item.org_slug}`, item.type, item.request_id),
        },
        footer: `Sent because you're a member of ${item.org_name} on space17-rms.`,
      });
      let problem: string | undefined;
      try {
        await send({ ...email, to: item.email, key: item.id });
        result.sent++;
      } catch (e) {
        problem = e instanceof Error ? e.message : "Unknown error";
        result.failed++;
      }
      await admin.rpc("finish_email", {
        p_id: item.id,
        p_attempt: item.attempt,
        p_ok: !problem,
        p_error: problem,
      });
    }
    if (data.length < BATCH) break;
  }
  return result;
}

/** Sends after the response, so people never wait for email. The scheduled job catches anything missed. */
export function deliverSoon() {
  after(async () => {
    try {
      await deliverEmails();
    } catch (error) {
      console.error("Email delivery failed", error instanceof Error ? error.message : "unknown");
    }
  });
}
