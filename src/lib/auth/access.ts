import "server-only";
import { notFound } from "next/navigation";
import { getOrganisationContext } from "./session";

/**
 * What each section needs: any one of these permissions. The menu and the pages both read this, so
 * a link never appears for a page that won't open. The database enforces the same rules on the data.
 */
export const ACCESS = {
  requests: ["requests.create", "requests.view"],
  expenses: ["expenses.create", "expenses.view", "expenses.accept"],
  approvals: ["requests.approve"],
  payments: ["payments.record", "payments.void"],
  reports: ["reports.view", "reports.submit", "reports.review"],
  members: ["members.manage", "org.manage", "audit.view"],
  departments: ["org.manage", "members.manage", "audit.view"],
  roles: ["roles.manage"],
  configuration: ["config.manage"],
  settings: ["org.manage"],
  audit: ["audit.view"],
  bankDetails: ["requests.create", "expenses.create"],
} as const;
export type Section = keyof typeof ACCESS;

export const opens = (can: (key: string) => boolean, section: Section) => ACCESS[section].some(can);

/** Layouts don't rerun on every navigation, so each page checks for itself. */
export async function requireSection(slug: string, section: Section) {
  const context = await getOrganisationContext(slug);
  if (!opens(context.can, section)) notFound();
  return context;
}
