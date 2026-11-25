import { redirect } from "next/navigation";

export default async function ConfigurationPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration">) {
  redirect(`/o/${(await params).orgSlug}/configuration/categories`);
}
