# RMS: UI Flows

Status: agreed, 25 November 2026. Covers Foundation and MVP. Read with [SCOPE.md](SCOPE.md) and [SCHEMA.md](SCHEMA.md).

## 1. Principles

- Mobile-first for staff and approvers; desktop-first for Finance and configuration.
- Every detail page answers: what is this, what is its status, who acts next, what can I do?
- One primary action per screen. Unavailable actions are hidden, unless the reason helps ("You can't approve your own request").
- Drafts save automatically. Failed uploads can be retried without losing the form.
- Every action ends with visible feedback: a toast for success or failure, with errors also kept beside the form. A message that must not disappear, such as an invitation link, stays on the page.
- Return, reject, void and waive require a reason. Final actions show a confirmation summary.
- Status uses text and icon as well as colour. Target WCAG 2.2 AA.
- Amounts show as ₦12,500.00; dates as 24 Nov 2026.

## 2. Navigation

| Section | Visible to |
|---|---|
| Dashboard, My requests, My expenses, Notifications | Everyone who can create |
| Approvals | Anyone eligible to approve; badge shows pending count |
| Department (expense inbox, reports) | HOD, deputy |
| Finance (payments, report review, internal receipts, periods) | Holders of the matching permission |
| Analytics | Anyone with department or org viewing scope |
| Admin (users, configuration, audit) | Admins; auditors see audit only |

The header has search, notifications and profile. Mobile uses a bottom bar: Home, Requests, Add (+), Expenses, More. An organisation switcher shows only for people in several organisations. Navigation follows permissions, not role names. Auditors see read-only views.

## 3. Access and onboarding

**New organisation**
1. Superadmin enters the email and sends an invite.
2. Recipient opens the link, sets a password and verifies MFA.
3. Dashboard checklist: two-step verification → departments → categories → invite staff → heads → approvers → payers. An optional starter set adds generic categories, templates and workflows.
4. Only organisation details are required to enter; the checklist tracks the rest.
5. The checklist warns if a category has fewer than two possible approvers, or the organisation fewer than two payers.

**Invited staff:** open link → set password, or sign in if the account exists → confirm name → dashboard.

**Join code:** enter code, name and email → verify email → "Awaiting approval" → admin assigns department and role → email with account link.

**Problem states:** expired, revoked or used link; wrong email; suspended member; suspended organisation. Each says what to do next. Join and reset forms never reveal whether an email is registered.

## 4. Staff

**Create a request**
1. One form: choose a category (filtered to the user's departments) and its questions and approvers appear. The draft saves from then on.
2. Fill in title, purpose, department, items and template fields; add attachments. On phones and tablets, every upload also offers **Take photo**.
3. Review the total and expected approval steps.
4. Submit; the number and timeline appear.

**Track a request:** detail page shows status, next actor, items, comments, payments and timeline. Available actions: edit (draft/returned), withdraw (pending), confirm receipt (paid), add expenses (received).

**Add an expense**
1. Photograph or upload a receipt, or choose **No receipt available**.
2. With a receipt: AI fills vendor, date and items, marked "Check these details". The user confirms.
3. Without: enter seller, location, items, amount and reason; optionally add a photo, transfer proof or acknowledgement. Phone is optional, with the hint "Leave blank if unknown".
4. Choose department funds or personal money, and optionally link a request.
5. Submit to the HOD.

If AI is off, over quota or fails, the manual form opens. Likely duplicates show a warning and a link to the match.

## 5. Approver

1. The inbox lists pending items, oldest first, with requester, category, amount and age.
2. Detail shows the request, attachments, policy flags and earlier decisions.
3. Choose **Approve**, **Return** or **Reject**. Approve allows item amounts to be reduced.
4. Confirm and move to the next item.

If someone else has already acted, the page refreshes and explains. There is no bulk approval in MVP.

## 6. HOD and deputy

**Expense inbox:** review submitted lines → accept, return or reject. Bulk accept is allowed only for lines with a vendor receipt and no flags.

**Monthly report**
1. Open the month; accepted lines are already there.
2. The header shows total, totals by category, evidence coverage and due date.
3. Add own lines, add a summary, resolve missing evidence.
4. Completeness check → submit. Missing evidence is a warning listing each line.
5. Respond to Finance queries on individual lines; resubmit if returned.

## 7. Finance

**Payments:** queue tabs are Requests and Reimbursements. Open an item → review approved, paid and balance → enter amount, date, method, reference and proof → record. Overpayment is blocked. Bank details are hidden until **Reveal**, which is audited.

**Report review**
1. Compliance list: departments by submitted, late and missing.
2. Split view on desktop: lines on the left, evidence on the right. Stacked on mobile.
3. Query lines, issue internal receipts, then approve or return.
4. Open queries block approval; missing evidence requires a written reason.

**Issue an internal receipt**
1. Open a line marked "No receipt".
2. Check seller, items, reason, evidence and flags. AI may suggest a clearer description.
3. Preview the receipt: organisation as issuer, "Cash Purchase Receipt", "Issued internally: vendor receipt unavailable".
4. Confirm → number assigned, PDF generated and attached.

The seller, amounts and date cannot be changed at this step; return the line to correct them. Issuing is unavailable to the person who entered the line. Void and reissue are on the receipt page.

**Close month:** checklist by department → approve or waive outstanding reports → confirm → locked.

**Adjustment:** open an approved report → add amount and reason → a second person approves.

**Export:** choose PDF, Excel or full pack → filter → background job → notification with an expiring download.

## 8. Admin

| Area | Flow |
|---|---|
| Users | Invite one or CSV (preview errors before sending), assign, suspend, offboard |
| Offboard | List pending work → choose replacements → deactivate |
| Roles | Permission grid with scope per row; warns before removing the last admin |
| Categories | Name, departments, template, workflow, approvers |
| Templates | Add, order and preview fields → publish a new version |
| Workflows | Ordered steps, approver, threshold, required approvals → test with a sample amount → publish |
| Join requests | Approve with department and role, or reject |
| Audit log | Filter by person, action, date and record; export |

MVP field types: short text, long text, number, money, date, dropdown, checkbox, file.

## 9. Superadmin

Organisations list, invite, suspend and limits; access request queue; usage totals without content. Support access: choose organisation → enter reason → timed read-only session with a permanent banner. Organisation admins are notified at the start and end.

## 10. Dashboards

| User | Shows |
|---|---|
| Staff | Open requests, returned items, awaiting confirmation, expenses to submit |
| Approver | Pending count, oldest item |
| HOD | Expense inbox, report due date, month spend, evidence coverage |
| Finance | Payments due, reports by status, queries, missing evidence |
| Admin | Setup checklist, pending joins, active users |
| Auditor | Spend, evidence coverage, internal receipts by department, waived reports |

## 11. Notifications

| Event | Recipient | Channel |
|---|---|---|
| Approval needed | Eligible approvers | In-app, email |
| Returned, rejected, approved, paid | Requester | In-app, email |
| Expense submitted | HOD, deputy | In-app, daily digest |
| Expense returned or rejected | Enterer | In-app, email |
| Report due in 3 days, due today, late | HOD, deputy | In-app, email |
| Report submitted | Reviewers | In-app, email |
| Line queried or answered | HOD or reviewer | In-app, email |
| Internal receipt issued or voided | Enterer, HOD | In-app |
| Join request | Admins | In-app, email |
| Support access start/end | Admins | In-app, email |

Security and support notices cannot be turned off.

## 12. Shared states

Lists share one data view: the page header holds Add; the toolbar holds search, filters, sort and a list (table) or grid (cards) toggle that is remembered. Add and edit open in a side panel. Each list has loading, empty, no-results, error and no-permission states. Filters stay in the URL. Short lists filter in the browser; people, requests, expenses and the full audit history use server pagination, search, filters and sorting. Tables hide secondary columns on mobile. An edit conflict shows the newer version before the user retries.
