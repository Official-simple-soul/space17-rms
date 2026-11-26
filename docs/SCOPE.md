# space17-rms: Product Scope

Status: scope agreed, 24 November 2026. No implementation has started.

## 1. Purpose

RMS is a multi-organisation platform for requests, approvals, payment records and departmental reports. Staff raise requests; authorised people approve them and record payment; each department accounts for its spending in a monthly expense report with evidence.

Launch context: Nigeria, about 250 users, naira by default. RMS records payments but does not move money.

## 2. Roles

| Level | Role | Responsibility |
|---|---|---|
| Platform | Superadmin | Invites and suspends organisations; no access to their content except through logged support sessions |
| Organisation | Org admin | Users, departments, roles, configuration |
| Organisation | Finance | Reviews reports, records payments, issues internal receipts, closes months |
| Organisation | Approver | Approves requests in assigned categories |
| Organisation | Auditor | Read-only access, including the audit log |
| Department | HOD | Compiles and submits the department's reports; may delegate to a deputy |
| Department | Staff | Creates requests and submits expenses to the HOD |

Superadmin is a fixed platform role. The others are default roles that each organisation can edit or add to.

## 3. Decisions

| Topic | Decision |
|---|---|
| Product | Multi-organisation; billing later, with `plan` and `limits` stored from the start |
| Registration | No public sign-up |
| Structure | Organisation, with departments and people; people belong to the organisation first |
| Landing page | The organisation dashboard (last used if several); Platform for superadmin |
| Membership | A person may join several organisations and several departments; one department is primary |
| Currency | One per organisation; NGN and Africa/Lagos by default |
| Requests | Any configured type, not only claims |
| Pre-approval | Optional; a request can be linked to an expense line |
| Approval | Anyone with permission for the category and scope |
| Multiple approvers | One approval is enough by default; a category can require more |
| Categories | Organisation-wide, with optional department restrictions |
| Funding | Department funds or personal reimbursement, set per expense line |
| Expenses | Staff submit to the HOD, who accepts lines into the report |
| Reports | HOD or delegated deputy submits; HOD cannot approve their own |
| Narrative reports | Supported after expense reports |
| Missing receipts | Internal Cash Purchase Receipt issued by the organisation; no amount cap |
| Support access | Time-limited, with a reason, and logged |

## 4. Registration and onboarding

| Route | Process |
|---|---|
| New organisation | Superadmin sends a single-use link, locked to an email and valid for 7 days. The recipient creates the organisation and becomes its first admin |
| Staff invitation | Admin invites by email or CSV, with role and department preset |
| Join code | Off by default. Email is verified first; the account is created only on admin approval; requests expire after 14 days |
| Organisation request | Short form to the superadmin queue; creates no account |

Public forms use CAPTCHA and rate limits. Links and codes can be revoked. Accounts are created server-side.

Setup wizard: organisation details → departments → roles → categories and templates → approvals → staff invitations.

## 5. Modules

1. **Auth and profile:** email/password, reset, optional Google sign-in, MFA for admins and Finance, signature, restricted bank details, sessions, notification preferences.
2. **Organisation:** branding, currency, timezone, fiscal year. There is no separate workspace layer; a switcher appears only for people in several organisations.
3. **Departments:** hierarchy, HOD, deputy, members. A grouping within the organisation; members can be in several or none.
4. **People:** organisation-wide list for those who manage or audit people, filterable by department; invite, assign, suspend, offboard and reassign work.
5. **Configuration:** roles, permissions, categories, templates, workflows, numbering, notifications, receipt branding.
6. **Requests:** custom forms, items, attachments, drafts, tracking.
7. **Approvals:** sequential steps, thresholds, return, delegation; parallel steps and escalation later.
8. **Payments:** queue, full or part payment, proof, requester confirmation.
9. **Expense reports:** monthly collection, evidence check, line queries, approval, closing, adjustments.
10. **Internal receipts:** issue, verify, void, reissue.
11. **Exports:** PDF, Excel, full evidence pack indexed by line number.
12. **Narrative reports:** templates, schedules, reminders, review.
13. **Budgets and cash advances:** budget vs spend; issue, retire and settle advances.
14. **Notifications:** in-app and email, reminders, digests.
15. **Dashboards:** spend, evidence coverage, report compliance, turnaround time.
16. **Comments, search, archive and audit log.**
17. **Platform console:** organisations, access requests, usage, limits, support sessions.

## 6. Core flows

**Request:** Draft → Pending → Approved → Part paid/Paid → Received → Accounted for → Closed. Alternative outcomes: Returned, Rejected, Cancelled. The requester can withdraw before final approval.

**Monthly expense report**

1. The system opens a report for each department.
2. Staff submit expenses during the month; the HOD accepts or returns them.
3. Each line has a vendor receipt, an internal receipt, or a Missing status.
4. The HOD submits after a completeness check.
5. Finance or another authorised person reviews, and may query individual lines.
6. Once approved, the month closes and the report locks. Later corrections are adjustments.

**Purchase without a receipt**

1. Staff choose "No receipt available" and give the seller, items, amounts and reason, with optional evidence.
2. AI tidies the description, suggests a category and flags unusual or duplicate entries.
3. The HOD accepts the expense into the report.
4. An authorised person, other than the one who entered it, reviews and issues the receipt.

## 7. Internal Cash Purchase Receipt

A small, simple receipt-style layout containing:

- Organisation name as issuer, number, date and QR verification code
- Title "Cash Purchase Receipt" and the line "Issued internally: vendor receipt unavailable"
- Actual seller name or description and location; phone is left blank unless real
- Items, quantities, unit prices, total, total in words
- Buyer's declaration and issuer's name

Receipts are never presented as issued by the seller. They cannot be edited after issue, only voided and reissued. Because there is no cap, value and frequency are flagged for review.

## 8. AI

| Feature | Phase |
|---|---|
| Extract data from uploaded receipts | MVP |
| Prepare internal receipt descriptions | MVP |
| Duplicate, altered-receipt and anomaly flags | Control |
| Report drafting and summaries | Control |
| Template builder | Control |
| Questions over permitted data | Scale |

Amounts, dates, sellers and numbers on receipts come from recorded data. AI suggests and people confirm; it never approves or pays. Each organisation has an on/off switch, quota and usage log.

## 9. Default permissions

Scopes: Own, Dept, Org.

| Action | Staff | HOD | Finance | Approver | Org admin | Auditor |
|---|---|---|---|---|---|---|
| Create request | Own | Own | Own | Own | Own | – |
| View requests | Own | Dept | Org | Assigned categories | Org | Org |
| Approve requests | – | – | – | Assigned categories | – | – |
| Record payment | – | – | Org | – | – | – |
| Submit expense to HOD | Own | Own | Own | Own | Own | – |
| Accept expenses, submit report | – | Dept | – | – | – | – |
| Review/approve report | – | – | Org | If granted | – | – |
| Issue/void internal receipt | – | – | Org | – | If granted | – |
| Export reports | – | Dept | Org | If granted | Org | Org |
| Close/reopen month | – | – | Org | – | If granted | – |
| Manage users and configuration | – | – | – | – | Org | – |
| View audit log | – | – | – | – | Org | Org |

Fixed rules that roles cannot override:

- Nobody approves or pays their own request.
- A report's submitter cannot approve it.
- The person who enters a purchase cannot issue its receipt.

## 10. Architecture

| Area | Decision |
|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind, shadcn/ui, Zod; mobile-first |
| Backend | Supabase Auth, Postgres, Storage, Cron and Queues |
| Structure | Modular monolith by feature: UI → server actions → services → data access |
| Tenancy | Shared database, `org_id` on tenant tables, Row Level Security |
| Permissions | `resource.action` plus scope |
| Workflow | Transactional Postgres functions for state, audit and related updates |
| Templates | Versioned; submissions keep their original version |
| Data | JSONB custom fields; columns for core fields; money in minor units |
| Files | Private buckets, signed URLs, image compression |
| AI | Server-side provider interface with schema-validated output |
| URLs | `/o/{org-slug}/...` |
| Compliance | Design for the Nigeria Data Protection Act: access control, retention, data export |
| Testing | RLS isolation, workflow unit tests, Playwright for key flows |

## 11. Data model

Overview only. [SCHEMA.md](SCHEMA.md) is the detailed and authoritative design.

| Area | Tables |
|---|---|
| Platform | `organisations`, `org_invites`, `access_requests`, `platform_admins`, `support_sessions` |
| People | `profiles`, `memberships`, `departments`, `department_members`, `invitations`, `join_requests` |
| Access | `roles`, `permissions`, `role_permissions`, `membership_roles`, `category_approvers` |
| Configuration | `categories`, `category_departments`, `templates`, `template_versions`, `workflows`, `workflow_versions`, `workflow_steps`, `number_sequences` |
| Requests | `requests`, `request_items`, `approval_steps`, `approval_actions` |
| Payments | `payments`, `payment_confirmations` |
| Reports | `report_periods`, `reports`, `expense_lines`, `line_queries`, `report_adjustments` |
| Evidence | `attachments`, `internal_receipts`, `ai_extractions` |
| Shared | `comments`, `notifications`, `audit_logs`, `ai_usage`, `exports` |

Expense lines start in the HOD's inbox and join a report on acceptance. A line may link to a request. A request may have several payments. Budget and advance tables will be designed in the Control phase.

## 12. Pages

| Area | Pages |
|---|---|
| Public | Sign in, Request access, Accept invite, Reset password, Verify receipt |
| Onboarding | Organisation wizard, Join pending |
| Main | Dashboard, Notifications, Search, Profile |
| Requests | My requests, New, Detail, Approval inbox |
| Finance | Payment queue, Payment history, Internal receipts |
| Reports | My expenses, HOD expense inbox, Department reports, Editor, Review, Detail, Export |
| Analytics | Spend, Evidence coverage, Report compliance |
| Configuration | Organisation, Departments, Roles, Categories, Templates, Workflows, Numbering |
| Admin | Users, Invitations and join requests, Audit log |
| Superadmin | Organisations, Invites, Access requests, Usage, Support access |

## 13. Phases

1. **Foundation:** auth, organisations, onboarding, departments, users, roles, audit log, basic platform console.
2. **MVP:** categories, templates, requests, sequential approvals, payments, expense reports, internal receipts, AI scan, exports, notifications, basic dashboards.
3. **Control:** narrative reports and schedules, budgets, advances, escalation, AI checks and drafting.
4. **Scale:** advanced analytics, AI assistant, demo organisation, billing, API, SSO, integrations.

Not in the current phases: vendors and purchase orders, asset register, native mobile apps, sending money.
