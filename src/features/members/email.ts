import "server-only";
import { env } from "@/config/env";
import { sendEmail } from "@/lib/email/provider";
import { renderEmail } from "@/lib/email/template";

export const joinLink = (token: string) => `${env.appUrl}/join/${token}`;

/** The link is secret, so these go out directly and are never stored. */
export function emailInvitation(to: string, orgName: string, token: string) {
  return sendEmail({
    to,
    ...renderEmail({
      subject: `Join ${orgName} on space17-rms`,
      heading: `You're invited to ${orgName}`,
      lines: ["Open the link to join. It works once, for this email address only, for 7 days."],
      action: { label: "Join", url: joinLink(token) },
    }),
  });
}

export function emailJoinCheck(to: string, orgName: string, token: string) {
  return sendEmail({
    to,
    ...renderEmail({
      subject: `Confirm your request to join ${orgName}`,
      heading: "Confirm your email address",
      lines: [
        `Someone used this address to ask to join ${orgName}. If it was you, confirm within 24 hours. An admin will then review it.`,
        "If it wasn't you, ignore this email.",
      ],
      action: { label: "Confirm", url: `${env.appUrl}/join/verify/${token}` },
    }),
  });
}

export function emailOrganisationInvite(to: string, link: string) {
  return sendEmail({
    to,
    ...renderEmail({
      subject: "Set up your organisation on space17-rms",
      heading: "Set up your organisation",
      lines: ["Open the link to begin. It works once, for this email address only, for 7 days."],
      action: { label: "Get started", url: link },
    }),
  });
}
