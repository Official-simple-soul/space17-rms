import { expect, it } from "vitest";
import { parseInvites } from "@/features/members/csv";

it("reads rows and skips the header", () => {
  const { rows, errors } = parseInvites(
    'email,role,department\r\nADA@x.com, "Staff", fin\n\nb@x.com,Finance',
  );
  expect(errors).toEqual([]);
  expect(rows.map((r) => [r.email, r.role, r.department])).toEqual([
    ["ada@x.com", "Staff", "fin"],
    ["b@x.com", "Finance", ""],
  ]);
});

it("reports bad, incomplete and repeated rows", () => {
  expect(parseInvites("nope,Staff\na@x.com\nb@x.com,Staff\nB@x.com,Staff").errors).toHaveLength(3);
});
