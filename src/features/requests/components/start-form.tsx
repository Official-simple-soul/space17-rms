"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField } from "@/components/ui/field";
import { startRequest } from "../actions";

type Category = { id: string; name: string; departments: string[] };

export function StartForm({
  orgId,
  slug,
  categories,
  departments,
}: {
  orgId: string;
  slug: string;
  categories: Category[];
  departments: { id: string; name: string }[];
}) {
  const [category, setCategory] = useState("");
  const allowed = categories.find((c) => c.id === category)?.departments ?? [];
  const choices = departments.filter((d) => allowed.includes(d.id));
  return (
    <ActionForm action={startRequest} submit="Continue" variant="brand">
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="slug" value={slug} />
          <SelectField
            label="What do you need?"
            name="categoryId"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            errors={state.fieldErrors?.categoryId}
          >
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          {choices.length > 1 && (
            <SelectField label="For which department?" name="departmentId" key={category}>
              {choices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectField>
          )}
          {choices.length === 1 && (
            <input type="hidden" name="departmentId" value={choices[0].id} />
          )}
        </>
      )}
    </ActionForm>
  );
}
