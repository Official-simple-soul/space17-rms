import type { Metadata } from "next";
import { FormDialog } from "@/components/ui/form-dialog";
import { CategoriesView } from "@/features/categories/components/categories-view";
import { CategoryForm } from "@/features/categories/components/category-forms";
import { listCategories } from "@/features/categories/repository";
import { ConfigurationHeader } from "@/features/configuration/components/configuration-header";
import { StarterSet } from "@/features/setup/components/starter-set";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({
  params,
}: PageProps<"/o/[orgSlug]/configuration/categories">) {
  const { orgSlug } = await params;
  const { organisation } = await requireSection(orgSlug, "configuration");
  const [categories, view] = await Promise.all([listCategories(organisation.id), getListView()]);
  return (
    <>
      <ConfigurationHeader
        slug={orgSlug}
        current="categories"
        action={
          <FormDialog label="Add category" title="Add category" variant="brand">
            <CategoryForm orgId={organisation.id} />
          </FormDialog>
        }
      />
      {categories.length === 0 && <StarterSet orgId={organisation.id} />}
      <CategoriesView rows={categories} view={view} orgId={organisation.id} />
    </>
  );
}
