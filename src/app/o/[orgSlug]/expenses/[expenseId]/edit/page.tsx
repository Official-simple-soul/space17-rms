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

export const metadata: Metadata = { title: "Edit expense" };

export default async function EditExpensePage({
  params,
}: PageProps<"/o/[orgSlug]/expenses/[expenseId]/edit">) {
  const { orgSlug, expenseId } = await params;
  const { organisation, can } = await getOrganisationContext(orgSlug);
  const expense = await getExpense(organisation.id, expenseId);
  if (!expense?.is_mine || !can("expenses.create")) notFound();
  const base = `/o/${orgSlug}/expenses`;
  if (expense.status !== "draft" && expense.status !== "returned")
    redirect(`${base}/${expense.id}`);
  const [categories, departments, requests, details] = await Promise.all([
    listExpenseCategories(organisation.id),
    listDepartments(organisation.id),
    listLinkableRequests(organisation.id),
    getOrganisation(organisation.id),
  ]);
  const last = expense.events.find((e) => e.type === "returned" || e.type === "removed");
  return (
    <>
      <Link
        href={expense.status === "draft" ? base : `${base}/${expense.id}`}
        className="text-muted mb-4 inline-block text-sm font-medium"
      >
        ← Back
      </Link>
      <PageHeader
        title={expense.status === "draft" ? "Add expense" : "Edit expense"}
        description="Saved as you type."
        action={expense.status === "draft" && <DeleteExpense id={expense.id} slug={orgSlug} />}
      />
      {expense.status === "returned" && last && (
        <div className="mb-6">
          <Notice tone="alert">
            {last.actor} returned this: {last.body}
          </Notice>
        </div>
      )}
      <ExpenseEditor
        orgId={organisation.id}
        base={base}
        currency={details.currency}
        today={todayIn(details.timezone)}
        expense={expense}
        categories={categories}
        departments={departments}
        requests={requests}
      />
    </>
  );
}
