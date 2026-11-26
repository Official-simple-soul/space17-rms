import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Notice, PageHeader } from "@/components/ui/surface";
import { listDepartments } from "@/features/departments/repository";
import { DeleteExpense } from "@/features/expenses/components/expense-actions";
import { ExpenseEditor } from "@/features/expenses/components/expense-editor";
import {
  getExpense,
  listExpenseCategories,
  listLinkableRequests,
} from "@/features/expenses/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { getOrganisationContext } from "@/lib/auth/session";
import { todayIn } from "@/lib/format";
import { text } from "@/lib/server-page";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/expenses/new">) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  if (!can("expenses.create")) notFound();
  const base = `/o/${orgSlug}/expenses`;
  const draft = text(query.draft);
  const expense = draft ? await getExpense(organisation.id, draft) : null;
  if (draft && !expense?.is_mine) notFound();
  if (expense && expense.status !== "draft") redirect(`${base}/${expense.id}`);
  const [categories, departments, requests, details] = await Promise.all([
    listExpenseCategories(organisation.id),
    listDepartments(organisation.id),
    listLinkableRequests(organisation.id),
    getOrganisation(organisation.id),
  ]);
  return (
    <>
      <Link href={base} className="text-muted mb-4 inline-block text-sm font-medium">
        ← Expenses
      </Link>
      <PageHeader
        title="Add expense"
        description="Saved as you type."
        action={expense && <DeleteExpense id={expense.id} slug={orgSlug} />}
      />
      {categories.length ? (
        <ExpenseEditor
          orgId={organisation.id}
          base={base}
          currency={details.currency}
          today={todayIn(details.timezone)}
          expense={expense}
          linkedRequestId={text(query.request)}
          categories={categories}
          departments={departments}
          requests={requests}
        />
      ) : (
        <Notice>
          You can&apos;t add expenses yet. Ask an admin to add you to a department and set up
          expense categories.
        </Notice>
      )}
    </>
  );
}
