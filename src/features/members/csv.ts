import { z } from "zod";

export type InviteRow = { line: number; email: string; role: string; department: string };

/** Reads pasted rows of: email, role, department code (optional). A header row is ignored. */
export function parseInvites(text: string): { rows: InviteRow[]; errors: string[] } {
  const rows: InviteRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    if (!raw.trim()) return;
    const [email = "", role = "", department = ""] = raw.split(",").map((v) =>
      v
        .trim()
        .replace(/^"(.*)"$/, "$1")
        .trim(),
    );
    if (line === 1 && email.toLowerCase() === "email") return;
    const address = email.toLowerCase();
    if (!z.email().safeParse(address).success)
      errors.push(`Line ${line}: "${email}" isn't a valid email.`);
    else if (!role) errors.push(`Line ${line}: add a role.`);
    else if (seen.has(address)) errors.push(`Line ${line}: ${address} is listed twice.`);
    else rows.push({ line, email: address, role, department });
    seen.add(address);
  });
  if (rows.length > 100) errors.push("Invite up to 100 people at a time.");
  return { rows, errors };
}
