import "server-only";
import { notFound } from "next/navigation";
import { getOrganisationContext } from "./session";

/** Layouts don't rerun on every navigation, so each configuration page checks for itself. */
export async function requireConfiguration(slug: string) {
  const context = await getOrganisationContext(slug);
  if (!context.can("config.manage")) notFound();
  return context;
}
