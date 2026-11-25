import "server-only";
import { cookies } from "next/headers";
import { LAST_ORG_COOKIE } from "@/config/constants";
import { getSession, listMyOrganisations } from "./session";

/** The organisation to open by default: the last one used, otherwise the first available. */
export async function getHomeOrganisation() {
  const [all, store] = await Promise.all([listMyOrganisations(), cookies()]);
  const open = all.filter((o) => o.isOpen);
  const last = store.get(LAST_ORG_COOKIE)?.value;
  // The cookie is only a preference; it can never open an organisation the user isn't in.
  return open.find((o) => o.slug === last) ?? open[0] ?? null;
}

export async function getHomePath() {
  const session = await getSession();
  if (!session) return "/sign-in";
  if (session.isPlatformAdmin) return "/platform";
  const organisation = await getHomeOrganisation();
  return organisation ? `/o/${organisation.slug}` : "/no-organisation";
}
