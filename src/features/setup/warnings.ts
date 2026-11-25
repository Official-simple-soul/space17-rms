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
    case "category_approvers":
      return {
        text: `${w.subject}: ${people(w.found)} can approve, ${w.needed} needed so requests never get stuck.`,
        href: `${base}/configuration/categories/${w.subject_id}`,
      };
    case "workflow_step":
      return {
        text: `${w.subject}: ${people(w.found)} can approve, ${w.needed} needed.`,
        href: `${base}/configuration/workflows/${w.subject_id}`,
      };
    case "payers":
      return {
        text: `${people(w.found)} can record payments. Have at least ${w.needed}, as no one pays their own request.`,
        href: `${base}/members`,
      };
    case "department_head":
      return { text: `${w.subject} has no head of department.`, href: `${base}/members` };
    default:
      return { text: w.subject ?? "Check your setup.", href: `${base}/configuration` };
  }
}
