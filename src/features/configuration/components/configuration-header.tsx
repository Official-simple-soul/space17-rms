import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";

const TABS = [
  { id: "categories", label: "Categories" },
  { id: "templates", label: "Templates" },
  { id: "workflows", label: "Workflows" },
  { id: "numbering", label: "Numbering" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function ConfigurationHeader({
  slug,
  current,
  action,
}: {
  slug: string;
  current: Tab;
  action?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Configuration"
        description="How requests and reports work in your organisation."
        action={action}
      />
      <LinkTabs
        label="Configuration sections"
        current={current}
        tabs={TABS.map((t) => ({ ...t, href: `/o/${slug}/configuration/${t.id}` }))}
      />
    </>
  );
}
