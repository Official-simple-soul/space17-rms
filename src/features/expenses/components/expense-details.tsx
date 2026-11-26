import Link from "next/link";
import { Card } from "@/components/ui/surface";
import { Term } from "@/components/ui/term";
import { Files } from "@/features/files/components/files";
import { formatDate, formatDateTime, formatMoney, formatMonth } from "@/lib/format";
import { FUNDING, PROOF, type ExpenseDetail } from "../schema";

const KINDS = { vendor_receipt: "Receipt", ...PROOF };

export function ExpenseDetails({ expense: e, base }: { expense: ExpenseDetail; base: string }) {
  const money = (minor: number) => formatMoney(minor, e.currency);
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Term label="Entered by">{e.by}</Term>
          <Term label="Date of purchase">{e.date ? formatDate(e.date) : "—"}</Term>
          <Term label="Department">{e.department?.name ?? "—"}</Term>
          <Term label="Category">{e.category?.name ?? "—"}</Term>
          <Term label="Seller">{e.seller || "—"}</Term>
          <Term label="Location">{e.location ?? "—"}</Term>
          {e.phone && <Term label="Phone">{e.phone}</Term>}
          <Term label="Paid with">{FUNDING[e.funding]}</Term>
          {e.request && (
            <Term label="Request">
              {e.request.visible ? (
                <Link href={`${base}/requests/${e.request.id}`} className="underline">
                  {e.request.number} {e.request.title}
                </Link>
              ) : (
                `${e.request.number} ${e.request.title}`
              )}
            </Term>
          )}
          {e.report && (
            <Term label="Report">
              {e.report.visible ? (
                <Link href={`${base}/reports/${e.report.id}`} className="underline">
                  {formatMonth(e.report.month)}
                </Link>
              ) : (
                formatMonth(e.report.month)
              )}
            </Term>
          )}
          {e.no_receipt && (
            <Term label="Why there's no receipt" className="sm:col-span-2">
              {e.no_receipt_reason}
            </Term>
          )}
        </dl>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-line text-muted border-b text-left text-xs">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="hidden px-5 text-right font-medium sm:table-cell">Quantity</th>
              <th className="hidden px-5 text-right font-medium sm:table-cell">Unit price</th>
              <th className="px-5 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {e.items.map((i) => (
              <tr key={i.id}>
                <td className="px-5 py-3.5">
                  {i.description}
                  <span className="text-muted block text-xs sm:hidden">
                    {i.quantity} × {money(i.unit_price_minor)}
                  </span>
                </td>
                <td className="hidden px-5 text-right tabular-nums sm:table-cell">{i.quantity}</td>
                <td className="hidden px-5 text-right tabular-nums sm:table-cell">
                  {money(i.unit_price_minor)}
                </td>
                <td className="px-5 text-right whitespace-nowrap tabular-nums">
                  {money(i.line_total_minor)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-line border-t font-semibold">
            <tr>
              <td className="px-5 py-3.5">Total</td>
              <td className="hidden sm:table-cell" colSpan={2} />
              <td className="px-5 text-right whitespace-nowrap tabular-nums">
                {money(e.total_minor)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
      {e.attachments.length > 0 && (
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Evidence</h2>
          {Object.entries(KINDS).map(([kind, label]) => {
            const files = e.attachments.filter((a) => a.field_key === kind);
            return files.length ? (
              <div key={kind} className="space-y-2">
                <h3 className="text-muted text-xs">{label}</h3>
                <Files files={files} base={`${base}/files`} />
              </div>
            ) : null;
          })}
        </Card>
      )}
    </div>
  );
}

const EVENT = {
  submitted: "submitted the expense",
  accepted: "accepted it into the report",
  returned: "returned the expense",
  rejected: "rejected the expense",
  withdrawn: "withdrew the expense",
  removed: "took it out of the report and returned it",
  evidence_added: "added a file",
} as const;

export function ExpenseTimeline({ events }: { events: ExpenseDetail["events"] }) {
  return (
    <ol className="divide-line divide-y">
      {events.map((e) => (
        <li key={e.id} className="py-4 text-sm first:pt-0 last:pb-0">
          <p>
            <span className="font-medium">{e.actor}</span> {EVENT[e.type]}
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
