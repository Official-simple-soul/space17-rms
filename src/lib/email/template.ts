const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

type Content = {
  subject: string;
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
  footer?: string;
};

/** One plain layout for every email. All values are escaped. */
export function renderEmail({ subject, heading, lines, action, footer }: Content) {
  const foot = footer ?? "Sent by space17-rms.";
  const text = [
    heading,
    "",
    ...lines,
    ...(action ? ["", `${action.label}: ${action.url}`] : []),
    "",
    foot,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:Inter,Arial,sans-serif;color:#0a0a0a"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><p style="font-weight:600;margin:0 0 20px">space17 <span style="color:#5f5f63;font-weight:400">RMS</span></p><div style="background:#fff;border:1px solid #e6e6e8;border-radius:16px;padding:28px"><h1 style="font-size:20px;line-height:1.3;margin:0 0 14px">${escape(heading)}</h1>${lines.map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${escape(l)}</p>`).join("")}${action ? `<p style="margin:22px 0 0"><a href="${escape(action.url)}" style="display:inline-block;background:#a30d1a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:15px;font-weight:500">${escape(action.label)}</a></p>` : ""}</div><p style="font-size:12px;color:#5f5f63;margin:18px 4px 0">${escape(foot)}</p></div></body></html>`;
  return { subject: subject.replace(/\s+/g, " ").slice(0, 150), text, html };
}
