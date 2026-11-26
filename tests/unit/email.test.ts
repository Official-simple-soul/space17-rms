import { describe, expect, it } from "vitest";
import { notificationMessage, notificationPath } from "@/features/notifications/message";
import { renderEmail } from "@/lib/email/template";

describe("email", () => {
  it("escapes everything people typed", () => {
    const { html } = renderEmail({
      subject: "x",
      heading: "<script>alert(1)</script>",
      lines: ['"quoted" & <b>bold</b>'],
      action: { label: "Open", url: 'https://a.test/"onclick="x' },
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold");
    expect(html).not.toContain('"onclick="');
  });
  it("keeps the subject on one line", () =>
    expect(renderEmail({ subject: "a\r\nBcc: b", heading: "", lines: [] }).subject).toBe(
      "a Bcc: b",
    ));
});

it("links each notification to its place", () => {
  const none = { request_id: null, expense_id: null, report_id: null };
  const path = (type: string, subject = {}) =>
    notificationPath("/o/a", type, { ...none, ...subject });
  expect(path("payment_recorded", { request_id: "r1" })).toBe("/o/a/requests/r1");
  expect(path("expense_returned", { expense_id: "e1" })).toBe("/o/a/expenses/e1");
  expect(path("report_late", { report_id: "p1" })).toBe("/o/a/reports/p1");
  expect(path("report_late")).toBe("/o/a/reports");
  expect(path("join_request")).toBe("/o/a/members?tab=requests");
  expect(notificationMessage("join_request", { requester: "Ada" })).toBe(
    "Ada asked to join your organisation",
  );
});
