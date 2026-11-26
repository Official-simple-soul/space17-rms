import { Check, Circle, Clock, X } from "lucide-react";
import { Card } from "@/components/ui/surface";
import { Term } from "@/components/ui/term";
import { Files } from "@/features/files/components/files";
import { TemplateAnswers } from "@/features/templates/components/template-answers";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RequestDetail } from "../schema";

export function RequestDetails({
  request: r,
  filesBase,
}: {
  request: RequestDetail;
  filesBase: string;
}) {
  const money = (minor: number) => formatMoney(minor, r.currency);
  const reduced = r.items.some((i) => i.approved_minor !== null);
  const general = r.attachments.filter((a) => a.field_key === null);
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Term label="Purpose" className="sm:col-span-2">
            {r.purpose || "—"}
          </Term>
          <Term label="Requested by">{r.requester}</Term>
          <Term label="Department">{r.department?.name ?? "—"}</Term>
          <Term label="Category">{r.category.name}</Term>
          <Term label="Needed by">{r.needed_by ? formatDate(r.needed_by) : "—"}</Term>
          <TemplateAnswers
            fields={r.fields}
            data={r.form_data}
            files={r.attachments}
            filesBase={filesBase}
            currency={r.currency}
          />
        </dl>
      </Card>
      {r.items.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Items</caption>
            <thead className="border-line text-muted border-b bg-neutral-50 text-xs">
              <tr>
                <th scope="col" className="px-3 py-3 font-medium sm:px-5">
                  Item
                </th>
                <th scope="col" className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                  Quantity
                </th>
                <th scope="col" className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                  Unit price
                </th>
                <th scope="col" className="px-3 py-3 text-right font-medium sm:px-5">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {r.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-3.5 sm:px-5">
                    {i.description}
                    <span className="text-muted block text-xs sm:hidden">
                      {i.quantity} × {money(i.unit_price_minor)}
                    </span>
                  </td>
                  <td className="hidden px-5 text-right tabular-nums sm:table-cell">
                    {i.quantity}
                  </td>
                  <td className="hidden px-5 text-right tabular-nums sm:table-cell">
                    {money(i.unit_price_minor)}
                  </td>
                  <td className="px-3 text-right whitespace-nowrap tabular-nums sm:px-5">
                    {i.approved_minor !== null && i.approved_minor !== i.line_total_minor ? (
                      <>
                        <s className="text-muted block text-xs">{money(i.line_total_minor)}</s>
                        {money(i.approved_minor)}
                      </>
                    ) : (
                      money(i.line_total_minor)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-line border-t font-semibold">
              <tr>
                <td className="px-3 py-3.5 sm:px-5" colSpan={1}>
                  {reduced ? "Approved total" : "Total"}
                </td>
                <td className="hidden sm:table-cell" colSpan={2} />
                <td className="px-3 text-right whitespace-nowrap tabular-nums sm:px-5">
                  {money(r.approved_minor ?? r.total_minor)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
      {general.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Attachments</h2>
          <Files files={general} base={filesBase} />
        </Card>
      )}
    </div>
  );
}

const STEP = {
  waiting: { icon: Circle, label: "Not started", tone: "bg-neutral-100 text-neutral-600" },
  active: { icon: Clock, label: "In progress", tone: "bg-brand-soft text-brand-strong" },
  approved: { icon: Check, label: "Approved", tone: "bg-ink text-white" },
  returned: { icon: X, label: "Returned", tone: "bg-brand text-white" },
  rejected: { icon: X, label: "Rejected", tone: "bg-brand text-white" },
  cancelled: { icon: Circle, label: "Not needed", tone: "bg-neutral-100 text-neutral-400" },
} as const;

export function ApprovalSteps({ steps }: { steps: RequestDetail["steps"] }) {
  return (
    <ol aria-label="Approval steps" className="space-y-4">
      {steps.map((s) => {
        const { icon: Icon, label, tone } = STEP[s.status];
        const shown = s.people.slice(0, 4);
        return (
          <li key={s.id} className="flex gap-3 text-sm">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", tone)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-muted text-xs">
                {label}
                {s.required > 1 && ` · ${s.approved} of ${s.required} approvals`}
              </p>
              {s.status === "active" && (
                <p className="mt-1 text-xs">
                  {shown.length
                    ? `Waiting for ${shown.join(", ")}${s.people.length > 4 ? ` or ${s.people.length - 4} more` : ""}`
                    : "No one can approve this now. An admin can reassign it."}
                </p>
              )}
              {s.status === "waiting" && <p className="text-muted text-xs">{s.who}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const EVENT = {
  submitted: "submitted the request",
  approved: "approved",
  returned: "returned the request",
  rejected: "rejected the request",
  withdrawn: "withdrew the request",
  reassigned: "reassigned the approval",
  commented: "commented",
  paid: "recorded a payment",
  payment_voided: "voided a payment",
  payment_confirmed: "confirmed receiving a payment",
} as const;

export function Timeline({
  events,
  currency,
}: {
  events: RequestDetail["events"];
  currency: string;
}) {
  return (
    <ol className="divide-line divide-y">
      {events.map((e) => (
        <li key={e.id} className="py-4 text-sm first:pt-0 last:pb-0">
          <p>
            <span className="font-medium">{e.actor}</span> {EVENT[e.type]}
            {e.type.startsWith("pa") &&
              e.amount_minor !== null &&
              ` of ${formatMoney(e.amount_minor, currency)}`}
            {e.step && ` (${e.step})`}
            {e.type === "approved" &&
              e.amount_minor !== null &&
              `, reduced to ${formatMoney(e.amount_minor, currency)}`}
          </p>
          {e.body && <p className="mt-1 break-words whitespace-pre-wrap">{e.body}</p>}
          <time dateTime={e.at} className="text-muted text-xs">
            {formatDateTime(e.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
