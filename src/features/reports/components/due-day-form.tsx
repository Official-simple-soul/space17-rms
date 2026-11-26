"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SelectField } from "@/components/ui/field";
import { setDueDay } from "../actions";

export function DueDayForm({ orgId, day }: { orgId: string; day: number }) {
  return (
    <ActionForm action={setDueDay} submit="Save deadline">
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <SelectField
            label="Expense reports are due on day"
            name="day"
            defaultValue={day}
            hint="Of the following month. Heads are reminded three days before, on the day and when late."
            errors={state.fieldErrors?.day}
          >
            {Array.from({ length: 28 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </SelectField>
        </>
      )}
    </ActionForm>
  );
}
