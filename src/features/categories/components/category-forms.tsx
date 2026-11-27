"use client";

import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/field";
import { archiveCategory, saveCategory } from "../actions";

type Category = { id: string; name: string };

export function CategoryForm({ orgId, category }: { orgId: string; category?: Category }) {
  return (
    <ActionForm action={saveCategory} closeOnSuccess submit={category ? "Save" : "Add category"}>
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="id" value={category?.id ?? ""} />
          <TextField
            label="Name"
            name="name"
            maxLength={80}
            defaultValue={category?.name}
            hint="Such as Food and kitchen, or Repairs."
            errors={state.fieldErrors?.name}
          />
        </>
      )}
    </ActionForm>
  );
}

export function ArchiveCategory({ orgId, id }: { orgId: string; id: string }) {
  return (
    <ActionForm
      action={archiveCategory}
      closeOnSuccess
      submit="Archive"
      variant="danger"
      className="mt-4 space-y-3"
      confirm={{
        title: "Archive this category?",
        description: "Past requests and expenses keep it; it just won't be offered any more.",
      }}
    >
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="id" value={id} />
        </>
      )}
    </ActionForm>
  );
}
