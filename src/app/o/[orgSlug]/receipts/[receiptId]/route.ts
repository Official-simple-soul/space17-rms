import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { receiptPdf } from "@/features/receipts/pdf";
import { getInternalReceipt } from "@/features/receipts/repository";
import { requireSession } from "@/lib/auth/session";

/** The receipt as a PDF, for people who may see the expense. Always drawn from what was issued. */
export async function GET(
  _: Request,
  { params }: RouteContext<"/o/[orgSlug]/receipts/[receiptId]">,
) {
  await requireSession();
  const receipt = await getInternalReceipt((await params).receiptId);
  if (!receipt) return new NextResponse("Not found", { status: 404 });
  const pdf = await receiptPdf(receipt, `${env.appUrl}/verify/${receipt.verify_token}`);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receipt.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
