import Link from "next/link";
import { Badge, Card } from "@/components/ui/surface";
import { ExpenseFlags } from "@/features/expenses/components/expense-badges";
import { FUNDING } from "@/features/expenses/schema";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { ReportDetail } from "../schema";
import { summarise } from "../summary";

export function ReportSummary({ report: r }: { report: ReportDetail }) {
  const s = summarise(r.lines);
  const stats = [
    { label: "Total", value: formatMoney(s.total, r.currency) },
    { label: "Expenses", value: String(r.lines.length) },
    { label: "With a receipt", value: `${s.coverage}%` },
    { label: "Due", value: formatDate(r.due_date) },
  ];
  return (
    <Card className="mb-6">
      <dl className="divide-line grid grid-cols-2 gap-y-5 p-5 lg:grid-cols-4">
        {stats.map((x) => (
          <div key={x.label}>
            <dt className="text-muted text-xs">{x.label}</dt>
            <dd className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>
      {s.categories.length > 0 && (
        <ul className="border-line flex flex-wrap gap-x-8 gap-y-2 border-t p-5 text-sm">
          {s.categories.map((c) => (
            <li key={c.name}>
              <span className="text-muted">{c.name}</span>{" "}
              <span className="font-medium tabular-nums">{formatMoney(c.total, r.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ReportLines({ report: r, base }: { report: ReportDetail; base: string }) {
  if (!r.lines.length)
    return (
      <Card className="text-muted p-6 text-sm">
        No expenses yet. Accepted expenses appear here automatically.
      </Card>
    );
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Expenses in this report</caption>
        <thead className="border-line text-muted border-b text-left text-xs">
          <tr>
            <th className="px-5 py-3 font-medium">Expense</th>
            <th className="hidden px-5 font-medium md:table-cell">Date</th>
            <th className="hidden px-5 font-medium 2xl:table-cell">Paid with</th>
            <th className="hidden px-5 font-medium md:table-cell">Receipt</th>
            <th className="px-5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {r.lines.map((l) => (
            <tr key={l.id}>
              <td className="space-y-1.5 px-5 py-3.5">
                <Link href={`${base}/expenses/${l.id}`} className="font-medium hover:underline">
                  {l.description}
                  <span className="text-muted block text-xs font-normal">
                    {l.seller} · {l.by} · {l.category}
                    {l.funding === "personal" && " · Personal money"}
                  </span>
                </Link>
                <ExpenseFlags flags={l.flags.filter((f) => f !== "missing_receipt")} />
                {l.evidence === "missing" && (
                  <span className="md:hidden">
                    <Badge tone="alert">No receipt</Badge>
                  </span>
                )}
              </td>
              <td className="hidden px-5 whitespace-nowrap md:table-cell">{formatDate(l.date)}</td>
              <td className="hidden px-5 2xl:table-cell">{FUNDING[l.funding]}</td>
              <td className="hidden px-5 md:table-cell">
                <Badge tone={l.evidence === "missing" ? "alert" : "neutral"}>
                  {l.evidence === "missing" ? "No receipt" : "Receipt"}
                </Badge>
              </td>
              <td className="px-5 text-right whitespace-nowrap tabular-nums">
                {formatMoney(l.total_minor, r.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function ReportTimeline({ events }: { events: ReportDetail["events"] }) {
  return (
    <ol className="divide-line divide-y">
      {events.map((e) => (
        <li key={e.id} className="py-4 text-sm first:pt-0 last:pb-0">
          <p>
            <span className="font-medium">{e.actor}</span> submitted the report
            {e.body && `, ${e.body}`}
          </p>
          <time dateTime={e.at} className="text-muted text-xs">
            {formatDateTime(e.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
