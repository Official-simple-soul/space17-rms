type Warning = {
  code: string;
  subject_id: string | null;
  subject: string | null;
  found: number;
  needed: number;
};

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** Plain wording and where to fix it. */
export function describeWarning(w: Warning, base: string): { text: string; href: string } {
  switch (w.code) {
    case "department_approvers":
      return {
        text:
          w.found === 0
            ? `No one can approve requests for ${w.subject}. Choose a head for it.`
            : `Only one person can approve requests for ${w.subject}, so their own requests would get stuck. Add a head, deputy or approver.`,
        href: `${base}/members`,
      };
    case "payers":
      return {
        text: `${people(w.found)} can record payments. Have at least ${w.needed}, as no one pays their own request. Give someone the Finance role.`,
        href: `${base}/members`,
      };
    case "department_head":
      return { text: `${w.subject} has no head of department.`, href: `${base}/members` };
    default:
      return { text: w.subject ?? "Check your setup.", href: `${base}/members` };
  }
}
