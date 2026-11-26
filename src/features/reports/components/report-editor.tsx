"use client";

import { AlertDialog } from "radix-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { buttonStyles } from "@/components/ui/button";
import { announceProblem, SavePanel } from "@/components/ui/save-panel";
import { Card, Notice } from "@/components/ui/surface";
import { FileUploader } from "@/features/files/components/file-uploader";
import { answerErrors, fromAnswers, toAnswers } from "@/features/templates/answers";
import { TemplateFields } from "@/features/templates/components/template-fields";
import { formatMoney, formatMonth } from "@/lib/format";
import { useAutosave } from "@/lib/use-autosave";
import { saveReport, startReportFile, submitReport } from "../actions";
import type { ReportDetail } from "../schema";
import { summarise } from "../summary";

/** The head's write-up and submission. Lines come from accepted expenses, not from here. */
export function ReportEditor({ report: r, base }: { report: ReportDetail; base: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() => toAnswers(r.fields, r.form_data));
  const [files, setFiles] = useState(r.attachments);
  const [checked, setChecked] = useState(false);
  const [asking, setAsking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { save, status, dirty, problem, setProblem, version } = useAutosave({
    content: { id: r.id, form: fromAnswers(r.fields, answers) },
    version: r.lock_version,
    paused: submitting,
    persist: (draft, lock) => saveReport({ ...draft, lock: lock! }),
  });
  const found = answerErrors(
    r.fields,
    answers,
    files.map((f) => f.field_key),
  );
  const incomplete = Object.keys(found).length > 0;
  const errors = checked ? found : {};
  const { total, missing } = summarise(r.lines);
  const unreceipted = r.lines.filter((l) => l.evidence === "missing");

  async function submit() {
    setSubmitting(true);
    setProblem("");
    try {
      // Always saved first, so the report carries the questions shown here.
      if (!(await save(true))) return;
      const result = await submitReport(r.id, version.current!, missing > 0);
      // Announced as a toast because refreshing may replace this form with newer details.
      if (result.ok) toast.success("Report submitted.");
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
        setChecked(true);
        if (incomplete) announceProblem("Check the highlighted answers.");
        else setAsking(true);
      }}
    >
      {r.fields.length > 0 && (
        <Card className="p-6">
          <TemplateFields
            fields={r.fields}
            controls={{
              values: answers,
              errors,
              onChange: (key, value) => setAnswers((all) => ({ ...all, [key]: value })),
              renderFile: (f) => (
                <FileUploader
                  field={f.key}
                  label="Add file"
                  files={files}
                  onChange={setFiles}
                  before={() => save(true)}
                  start={(file) => startReportFile({ ...file, reportId: r.id, field: f.key })}
                />
              ),
            }}
          />
        </Card>
      )}
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
              {unreceipted.length} without a receipt. You can still submit.
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
            submit="Submit report"
            submitting={submitting}
            problem={problem || (checked && incomplete ? "Check the highlighted answers." : "")}
            status={status}
            dirty={dirty}
            onRetry={() => void save()}
          />
        ) : (
          <Notice>You can submit this once {formatMonth(r.month)} begins.</Notice>
        )}
      </Card>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={`Submit the ${formatMonth(r.month)} report?`}
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
          Submit report
        </AlertDialog.Action>
      </ConfirmDialog>
    </form>
  );
}
