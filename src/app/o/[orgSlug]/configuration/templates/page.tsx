import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { ConfigurationHeader } from "@/features/configuration/components/configuration-header";
import { TemplatesView } from "@/features/templates/components/templates-view";
import { listTemplateDetails } from "@/features/templates/repository";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/templates">) {
  const { orgSlug } = await params;
  const { organisation } = await requireSection(orgSlug, "configuration");
  const [rows, view] = await Promise.all([listTemplateDetails(organisation.id), getListView()]);
  const base = `/o/${orgSlug}/configuration/templates`;
  return (
    <>
      <ConfigurationHeader
        slug={orgSlug}
        current="templates"
        action={
          <Link href={`${base}/new`} className={buttonStyles({ variant: "brand" })}>
            <Plus className="size-4" aria-hidden />
            New template
          </Link>
        }
      />
      <TemplatesView rows={rows} view={view} base={base} />
    </>
  );
}
