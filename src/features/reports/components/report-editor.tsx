"use client";

import { AlertDialog } from "radix-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { buttonStyles } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { SavePanel } from "@/components/ui/save-panel";
import { Card, Notice } from "@/components/ui/surface";
import { FileUploader } from "@/features/files/components/file-uploader";
import { formatMoney, formatMonth } from "@/lib/format";
import { useAutosave } from "@/lib/use-autosave";
import { saveReport, startReportFile, submitReport } from "../actions";
import type { ReportDetail } from "../schema";
import { summarise } from "../summary";

/** The head's write-up and submission. Lines come from accepted expenses, not from here. */
export function ReportEditor({ report: r, base }: { report: ReportDetail; base: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState(r.summary);
  const [files, setFiles] = useState(r.attachments);
  const [asking, setAsking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { save, status, dirty, problem, setProblem, version } = useAutosave({
    content: { id: r.id, summary },
    version: r.lock_version,
    paused: submitting,
    persist: (draft, lock) => saveReport({ ...draft, lock: lock! }),
  });
  const { total, missing } = summarise(r.lines);
  const unreceipted = r.lines.filter((l) => l.evidence === "missing");

  async function submit() {
    setSubmitting(true);
    setProblem("");
    try {
      // Always saved first, so the report carries the summary shown here.
      if (!(await save(true))) return;
      const result = await submitReport(r.id, version.current!, missing > 0);
      // Announced as a toast because refreshing may replace this form with newer details.
      if (result.ok) toast.success("Report sent to Finance.");
      else toast.error(result.message ?? "Something went wrong. Please try again.");
      router.refresh();
    } catch {
      setProblem("The report wasn't submitted. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setAsking(true);
      }}
    >
      <Card className="space-y-5 p-6">
        <TextArea
          label="Anything Finance should know? (optional)"
          name="summary"
          maxLength={5000}
          hint="For example, why spending was higher this month."
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <div>
          <p className="text-sm font-medium">Supporting files (optional)</p>
          <div className="mt-2">
            <FileUploader
              label="Add file"
              files={files}
              onChange={setFiles}
              before={() => save(true)}
              start={(file) => startReportFile({ ...file, reportId: r.id, field: null })}
            />
          </div>
        </div>
      </Card>
      <Card className="space-y-5 p-6">
        {r.waiting > 0 && (
          <Notice>
            {r.waiting} {r.waiting === 1 ? "expense is" : "expenses are"} waiting for your review.{" "}
            <Link href={`${base}/expenses?tab=inbox`} className="font-medium underline">
              Review
            </Link>
          </Notice>
        )}
        {unreceipted.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">
              {unreceipted.length} without a receipt. You can still send it.
            </p>
            <ul className="mt-2 space-y-1">
              {unreceipted.map((l) => (
                <li key={l.id}>
                  <Link href={`${base}/expenses/${l.id}`} className="underline">
                    {l.description}
                  </Link>{" "}
                  <span className="text-muted">{formatMoney(l.total_minor, r.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.started ? (
          <SavePanel
            submit="Send to Finance"
            submitting={submitting}
            problem={problem}
            status={status}
            dirty={dirty}
            onRetry={() => void save()}
          />
        ) : (
          <Notice>You can send this once {formatMonth(r.month)} begins.</Notice>
        )}
      </Card>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={`Send the ${formatMonth(r.month)} report to Finance?`}
        description={[
          `${r.lines.length} ${r.lines.length === 1 ? "expense" : "expenses"}, ${formatMoney(total, r.currency)}.`,
          missing > 0 && `${missing} without a receipt.`,
          !r.month_over && "The month isn't over: later expenses will go into the next report.",
          r.waiting > 0 && "Expenses still waiting for review won't be included.",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <AlertDialog.Action
          type="button"
          className={buttonStyles({ variant: "brand" })}
          onClick={() => void submit()}
        >
          Send to Finance
        </AlertDialog.Action>
      </ConfirmDialog>
    </form>
  );
}
