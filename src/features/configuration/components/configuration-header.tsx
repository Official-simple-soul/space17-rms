import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";

const TABS = [
  { id: "categories", label: "Categories" },
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
        title="Categories"
        description="Optional labels for grouping spending, and how reference numbers look."
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
