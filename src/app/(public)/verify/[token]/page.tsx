import { BadgeCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import { Term } from "@/components/ui/term";
import { checkReceipt } from "@/features/receipts/repository";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Check a receipt", referrer: "no-referrer" };

/** Where a receipt's QR code leads: shows whether it is genuine, and only the details printed on it. */
export default async function VerifyReceiptPage({ params }: PageProps<"/verify/[token]">) {
  const receipt = await checkReceipt((await params).token);
  if (!receipt)
    return (
      <>
        <CircleX className="text-brand mb-4 size-10" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t find this receipt
        </h1>
        <p className="text-muted mt-2">
          Check that the whole link was copied. If it still doesn&apos;t work, the receipt
          wasn&apos;t issued through this system.
        </p>
      </>
    );
  const valid = receipt.status === "issued";
  return (
    <>
      {valid ? (
        <BadgeCheck className="mb-4 size-10 text-emerald-700" aria-hidden />
      ) : (
        <CircleX className="text-brand mb-4 size-10" aria-hidden />
      )}
      <h1 className="text-2xl font-semibold tracking-tight">
        {valid ? "This receipt is genuine" : "This receipt was voided"}
      </h1>
      <p className="text-muted mt-2">
        {valid
          ? `${receipt.issuer} issued this Cash Purchase Receipt because the seller gave none.`
          : `${receipt.issuer} cancelled this receipt${receipt.voided_at ? ` on ${formatDate(receipt.voided_at)}` : ""}. It should not be relied on.`}
      </p>
      <dl className="mt-8 grid gap-5 sm:grid-cols-2">
        <Term label="Receipt">{receipt.number}</Term>
        <Term label="Issued">{formatDate(receipt.issued_at)}</Term>
        <Term label="Seller">{receipt.seller}</Term>
        <Term label="Date of purchase">
          {receipt.purchase_date ? formatDate(receipt.purchase_date) : "—"}
        </Term>
        <Term label="Total">{formatMoney(receipt.total_minor, receipt.currency)}</Term>
      </dl>
    </>
  );
}
