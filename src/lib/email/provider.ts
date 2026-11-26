import "server-only";

export type Email = { to: string; subject: string; text: string; html: string; key?: string };
type Provider = (email: Email) => Promise<void>;

const FROM = () => process.env.EMAIL_FROM ?? "space17-rms <no-reply@localhost>";

/** Local development only: delivers to the Mailpit inbox that ships with Supabase. */
function mailpit(base: string): Provider {
  return async ({ to, subject, text, html }) => {
    const response = await fetch(`${base}/api/v1/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        From: { Email: "no-reply@space17-rms.local", Name: "space17-rms" },
        To: [{ Email: to }],
        Subject: subject,
        Text: text,
        HTML: html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Mailpit ${response.status}`);
  };
}

function resend(apiKey: string): Provider {
  return async ({ to, subject, text, html, key }) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // A retry after a lost response does not send twice.
        ...(key && { "idempotency-key": key }),
      },
      body: JSON.stringify({ from: FROM(), to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
  };
}

/** True in local development, where emails never reach real people. */
export const usesTestInbox = () => !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM;

/** Null when email isn't set up; callers then keep working without it. */
export function getEmailProvider(): Provider | null {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
    return resend(process.env.RESEND_API_KEY);
  const local = process.env.MAILPIT_URL;
  if (local && ["127.0.0.1", "localhost"].includes(new URL(local).hostname)) return mailpit(local);
  return null;
}

/** Sends one email now. Returns false instead of failing the action that asked for it. */
export async function sendEmail(email: Email): Promise<boolean> {
  const send = getEmailProvider();
  if (!send) return false;
  try {
    await send(email);
    return true;
  } catch (error) {
    console.error("Email not sent", error instanceof Error ? error.message : "unknown");
    return false;
  }
}
