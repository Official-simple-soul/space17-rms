import type { Metadata } from "next";
import { ConfigurationHeader } from "@/features/configuration/components/configuration-header";
import { NumberingView } from "@/features/numbering/components/numbering-view";
import { listNumbering } from "@/features/numbering/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { requireSection } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Numbering" };

export default async function NumberingPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/numbering">) {
  const { orgSlug } = await params;
  const { organisation } = await requireSection(orgSlug, "configuration");
  const [rows, details] = await Promise.all([
    listNumbering(organisation.id),
    getOrganisation(organisation.id),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: details.timezone }).format(new Date());
  return (
    <>
      <ConfigurationHeader slug={orgSlug} current="numbering" />
      <NumberingView rows={rows} orgId={organisation.id} today={today} />
    </>
  );
}
