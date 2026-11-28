import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { formatDate } from "@/lib/format";
import type { InternalReceipt } from "./schema";

const INK = rgb(0.04, 0.04, 0.04);
const MUTED = rgb(0.37, 0.37, 0.39);
const BRAND = rgb(0.64, 0.05, 0.1);
const LINE = rgb(0.88, 0.88, 0.9);

/** The standard PDF fonts cover Western characters only; anything else becomes a plain equivalent. */
function plain(text: string) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/₦/g, "NGN ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function money(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Splits text into lines that fit the width. */
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of plain(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draws a Cash Purchase Receipt from what was recorded when it was issued. */
export async function receiptPdf(r: InternalReceipt, verifyUrl: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${r.number} Cash Purchase Receipt`);
  pdf.setAuthor(plain(r.issuer));
  pdf.setCreator("space17 RMS");
  const page: PDFPage = pdf.addPage([420, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const left = 32;
  const right = 388;
  const width = right - left;
  let y = 555;

  const text = (value: string, x: number, size: number, font = regular, color = INK) =>
    page.drawText(plain(value), { x, y, size, font, color });
  const rightText = (value: string, x: number, size: number, font = regular, color = INK) =>
    page.drawText(plain(value), {
      x: x - font.widthOfTextAtSize(plain(value), size),
      y,
      size,
      font,
      color,
    });
  const rule = () => {
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: LINE });
  };

  // Issuer and title.
  for (const line of wrap(r.issuer, bold, 15, width)) {
    text(line, left, 15, bold);
    y -= 18;
  }
  y -= 4;
  text("CASH PURCHASE RECEIPT", left, 11, bold, BRAND);
  rightText(r.number, right, 11, bold);
  y -= 14;
  text("Issued internally: vendor receipt unavailable", left, 8.5, italic, MUTED);
  y -= 18;
  rule();
  y -= 18;

  // Dates and seller.
  const field = (label: string, value: string, x: number, w: number) => {
    page.drawText(plain(label), { x, y, size: 7.5, font: regular, color: MUTED });
    let line = y - 11;
    for (const part of wrap(value, regular, 9.5, w)) {
      page.drawText(part, { x, y: line, size: 9.5, font: regular, color: INK });
      line -= 12;
    }
    return y - line;
  };
  const half = width / 2 - 8;
  const top = Math.max(
    field("Date of purchase", r.purchase_date ? formatDate(r.purchase_date) : "-", left, half),
    field("Date issued", formatDate(r.issued_at), left + width / 2, half),
  );
  y -= top + 8;
  const sellerRows = Math.max(
    field("Seller", r.seller, left, half),
    field(
      "Seller's location and phone",
      [r.location, r.phone].filter(Boolean).join(" · ") || "-",
      left + width / 2,
      half,
    ),
  );
  y -= sellerRows + 8;
  y -= field("What was bought", r.description, left, width) + 10;

  // Items.
  rule();
  y -= 14;
  text("Item", left, 7.5, regular, MUTED);
  rightText("Qty", right - 150, 7.5, regular, MUTED);
  rightText("Unit price", right - 78, 7.5, regular, MUTED);
  rightText("Amount", right, 7.5, regular, MUTED);
  y -= 14;
  for (const item of r.items) {
    const lines = wrap(item.description, regular, 9, width - 190);
    text(lines[0] ?? "", left, 9);
    rightText(String(item.quantity), right - 150, 9);
    rightText(money(item.unit_price_minor, r.currency), right - 78, 9);
    rightText(money(item.line_total_minor, r.currency), right, 9);
    for (const extra of lines.slice(1)) {
      y -= 11;
      text(extra, left, 9);
    }
    y -= 14;
  }
  rule();
  y -= 16;
  text("Total", left, 10.5, bold);
  rightText(money(r.total_minor, r.currency), right, 10.5, bold);
  y -= 22;

  // Why, and who.
  if (r.reason) y -= field("Why there is no seller's receipt", r.reason, left, width) + 8;
  const people = Math.max(
    field("Department", r.department ?? "-", left, half),
    field("Entered by", r.entered_by, left + width / 2, half),
  );
  y -= people + 8;
  y -= field("Issued by", `${r.issued_by}, for ${r.issuer}`, left, width) + 8;
  if (r.replaces) y -= field("Replaces", `${r.replaces}, which was voided`, left, width) + 8;

  // The QR code opens the public check page.
  const qr = await pdf.embedPng(
    await QRCode.toBuffer(verifyUrl, { margin: 1, width: 180, errorCorrectionLevel: "M" }),
  );
  const size = 78;
  page.drawImage(qr, { x: right - size, y: 30, width: size, height: size });
  y = 96;
  text("Check this receipt", left, 8.5, bold);
  y -= 12;
  for (const line of wrap(
    "Scan the code, or open the link below, to confirm it was issued by the organisation.",
    regular,
    7.5,
    width - size - 16,
  )) {
    text(line, left, 7.5, regular, MUTED);
    y -= 10;
  }
  for (const line of wrap(verifyUrl, regular, 6.5, width - size - 16)) {
    text(line, left, 6.5, regular, MUTED);
    y -= 9;
  }

  if (r.status === "voided") {
    page.drawText("VOID", {
      x: 92,
      y: 250,
      size: 110,
      font: bold,
      color: BRAND,
      opacity: 0.18,
      rotate: degrees(30),
    });
    y = 30;
    text(`Voided${r.void_reason ? `: ${r.void_reason}` : ""}`.slice(0, 90), left, 8, bold, BRAND);
  }

  return pdf.save();
}
