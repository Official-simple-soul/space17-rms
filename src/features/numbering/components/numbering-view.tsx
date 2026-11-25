"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SelectField, TextField } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Card } from "@/components/ui/surface";
import { saveNumbering } from "../actions";
import { DOCUMENTS, exampleNumber, RESETS, type DocumentType, type Reset } from "../format";

export type NumberingRow = { type: DocumentType; prefix: string; reset: Reset; digits: number };

function NumberingForm({ orgId, row, today }: { orgId: string; row: NumberingRow; today: string }) {
  const [draft, setDraft] = useState({ ...row, digits: String(row.digits) });
  return (
    <ActionForm action={saveNumbering} submit="Save" closeOnSuccess>
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="type" value={row.type} />
          <TextField
            label="Prefix"
            name="prefix"
            maxLength={8}
            className="uppercase"
            value={draft.prefix}
            onChange={(e) => setDraft({ ...draft, prefix: e.target.value })}
            errors={state.fieldErrors?.prefix}
          />
          <SelectField
            label="Restart numbering"
            name="reset"
            value={draft.reset}
            onChange={(e) => setDraft({ ...draft, reset: e.target.value as Reset })}
          >
            {Object.entries(RESETS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Minimum digits"
            name="digits"
            type="number"
            min={3}
            max={8}
            value={draft.digits}
            onChange={(e) => setDraft({ ...draft, digits: e.target.value })}
            errors={state.fieldErrors?.digits}
          />
          <p className="rounded-control bg-neutral-100 p-3 text-sm">
            Example:{" "}
            <strong className="font-mono">
              {exampleNumber({ ...draft, digits: Math.min(Number(draft.digits) || 0, 8) }, today)}
            </strong>
          </p>
          <p className="text-muted text-xs">Numbers already issued don&apos;t change.</p>
        </>
      )}
    </ActionForm>
  );
}

export function NumberingView({
  rows,
  orgId,
  today,
}: {
  rows: NumberingRow[];
  orgId: string;
  today: string;
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-line text-muted border-b bg-neutral-50 text-xs">
          <tr>
            {["Document", "Format", "Restarts"].map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-5 py-3 font-medium ${i === 2 ? "hidden sm:table-cell" : ""}`}
              >
                {h}
              </th>
            ))}
            <th scope="col" className="px-5 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {rows.map((r) => (
            <tr key={r.type}>
              <td className="px-5 py-3.5 font-medium">{DOCUMENTS[r.type]}</td>
              <td className="px-5 py-3.5 font-mono text-xs whitespace-nowrap">
                {exampleNumber(r, today)}
              </td>
              <td className="hidden px-5 py-3.5 sm:table-cell">{RESETS[r.reset]}</td>
              <td className="px-5 py-3.5 text-right">
                <FormDialog
                  label="Edit"
                  ariaLabel={`Edit ${DOCUMENTS[r.type]} numbering`}
                  title={`${DOCUMENTS[r.type]} numbering`}
                  variant="outline"
                  size="sm"
                >
                  <NumberingForm orgId={orgId} row={r} today={today} />
                </FormDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
