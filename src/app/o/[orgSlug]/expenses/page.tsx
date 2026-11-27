import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { listCategories } from "@/features/categories/repository";
import { listDepartments } from "@/features/departments/repository";
import { AcceptReady } from "@/features/expenses/components/expense-actions";
import { ExpensesView } from "@/features/expenses/components/expenses-view";
import { listExpenses, listReadyExpenses, type ExpenseView } from "@/features/expenses/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { getMyWork } from "@/features/requests/repository";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/expenses">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const { organisation, permissions, can } = await requireSection(orgSlug, "expenses");
  const work = await getMyWork(organisation.id);
  const creates = can("expenses.create");
  const seesMore = permissions.some(
    (p) => p.permission_key === "expenses.view" && p.scope !== "own",
  );
  const tabs: { id: ExpenseView; label: string; count?: number }[] = [
    ...(creates ? [{ id: "mine" as const, label: "My expenses" }] : []),
    ...(can("expenses.accept")
      ? [{ id: "inbox" as const, label: "To review", count: work.expenses_waiting }]
      : []),
    ...(seesMore ? [{ id: "all" as const, label: "All expenses" }] : []),
  ];
  const base = `/o/${orgSlug}/expenses`;
  const mode = tabs.find((t) => t.id === query.tab)?.id ?? tabs[0]?.id ?? "mine";
  const [expenses, categories, departments, details, view, ready] = await Promise.all([
    listExpenses(organisation.id, mode, query),
    listCategories(organisation.id),
    listDepartments(organisation.id),
    getOrganisation(organisation.id),
    getListView(),
    mode === "inbox" ? listReadyExpenses(organisation.id) : [],
  ]);
  return (
    <>
      <PageHeader
        title="Expenses"
        description="Account for what was spent."
        action={
          <div className="flex flex-wrap gap-3">
            {ready.length > 0 && (
              <AcceptReady orgId={organisation.id} lines={ready} currency={details.currency} />
            )}
            {creates && (
              <Link href={`${base}/new`} className={buttonStyles({ variant: "brand" })}>
                <Plus className="size-4" aria-hidden />
                Add expense
              </Link>
            )}
          </div>
        }
      />
      {tabs.length > 1 && <LinkTabs label="Expense lists" base={base} current={mode} tabs={tabs} />}
      <ExpensesView
        key={mode}
        mode={mode}
        {...expenses}
        view={view}
        base={base}
        currency={details.currency}
        categories={categories}
        departments={departments}
      />
    </>
  );
}
