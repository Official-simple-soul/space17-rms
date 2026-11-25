# space17-rms: Build Plan

Status: draft for review. Read with [SCOPE.md](SCOPE.md), [SCHEMA.md](SCHEMA.md) and [UI_FLOWS.md](UI_FLOWS.md). No code has been written.

## 1. Project decisions

| Item | Decision |
|---|---|
| Product name | space17-rms |
| Database | Supabase, Europe; record the exact region shown in project settings |
| Supabase settings | Data API on, automatic table grants off, automatic RLS on, public sign-up off |
| AI | Claude, server-side behind a provider interface; model set by environment variable and chosen by testing on receipts |
| Email | Resend |
| Templates | Generic starter templates until sample documents are available |
| Branding | Neutral theme using design tokens until a logo and colours are supplied |
| Environments | Local, development, production; separate Supabase projects for the last two |

## 2. Code structure

```text
src/
  app/            routes: (public), (auth), o/[orgSlug], platform
  features/       requests, approvals, payments, expenses, reports, receipts, ...
    <feature>/    components, actions, service, repository, schema, types
  lib/            supabase, auth, permissions, money, dates, email, ai, pdf
  components/ui/  shared components
supabase/
  migrations/     tables, grants, RLS, functions
  seed.sql        permissions and local test data
  tests/          RLS and transition tests
tests/e2e/        Playwright
```

Features import each other only through a public `index.ts`. Business rules that protect data live in Postgres functions; services coordinate, and components contain no data access.

## 3. Definition of done

Every task has: types and validation, explicit grants and RLS, loading/empty/error states, mobile check, audit entries for changes, tests for its rules, and passing lint, type check and CI.

## 4. Milestones

Sizes are relative: S, M, L.

### M0: Project setup

| Task | Size | Accepted when |
|---|---|---|
| Next.js, TypeScript, Tailwind, shadcn/ui, linting | S | App runs; checks pass |
| Local Supabase and migrations | S | A clean reset builds the database |
| Environment validation | S | App fails clearly on missing values; secrets never reach the client bundle |
| CI | S | Every change runs lint, types, tests and migrations |
| Design tokens and app shell | M | Responsive navigation and shared states work |

### M1: Identity and organisations

| Task | Size | Accepted when |
|---|---|---|
| Core tables, RLS helpers, audit log | L | Organisation isolation tests pass |
| Sign-in, reset, MFA, profile | M | Sensitive actions fail without `aal2` |
| First superadmin setup | S | Created by a controlled server script, not a public route |
| Organisation invite and creation | M | Link is single-use, email-locked and expires |
| Sign-up auth hook | S | Uninvited account creation fails |
| Landing page and organisation switcher | S | Sign-in opens the organisation; switcher shows only for several; switching never shows the previous organisation's data |

### M2: People, access and configuration

| Task | Size | Accepted when |
|---|---|---|
| Departments and members | M | People page lists the whole organisation with a department filter; one HOD per department; deputy grants expire |
| Roles and permission grid | L | Scopes enforced in the database; last admin protected |
| Staff invite, CSV and join code | L | No auth user exists before join approval |
| Offboarding | M | Access ends immediately; pending work is reassigned |
| Categories, templates, numbering | L | Published versions are immutable; concurrent numbers are unique |
| Workflow editor | M | Sample amount shows the correct steps |
| Setup wizard and checklist | M | Warns about missing approvers or payers |

### M3: Requests, approvals and payments

| Task | Size | Accepted when |
|---|---|---|
| Request form, drafts, attachments | L | Drafts recover; files are private |
| Approval engine | L | Thresholds, multiple approvers, return and resubmit work |
| Approval inbox and timeline | M | Only eligible people see and act |
| Payment queue and confirmation | L | Part payment works; overpayment and self-payment fail |
| Bank detail protection | M | Encrypted; each reveal is audited |
| In-app and email notifications | M | Emails retry without duplicates |

### M4: Expenses, reports and receipts

| Task | Size | Accepted when |
|---|---|---|
| Expense entry and HOD inbox | L | Evidence status is correct; bulk accept respects its limits |
| Monthly periods and reports | L | One report per department per month; submitter cannot approve |
| Finance review and line queries | M | Open queries block approval; missing evidence needs a reason |
| Reimbursements | M | Personal expenses can be paid and confirmed |
| Internal Cash Purchase Receipt | L | Organisation is issuer; enterer cannot issue; snapshot is frozen |
| QR verification, void and reissue | M | Public page shows only agreed fields |
| Month closing and adjustments | M | Locked lines never change; second person approves adjustments |

### M5: AI, exports and insight

| Task | Size | Accepted when |
|---|---|---|
| AI consent, quota and logging | S | Off switch stops all AI calls |
| Receipt scan | M | Output is validated and user-confirmed; failure opens the manual form |
| Internal receipt description help | S | AI cannot alter seller, amount or date |
| Duplicate warnings | S | Same file or similar expense is flagged |
| PDF, Excel and full evidence pack | L | Totals match the report; links expire |
| Dashboards, search, audit viewer | M | Results respect permissions |
| Platform console and support access | M | Read-only, timed, logged and visible to admins |

### M6: Launch readiness

| Task | Size | Accepted when |
|---|---|---|
| Security review | M | No open critical or high findings; all SCHEMA section 7 tests pass |
| Load test | S | Agreed targets met with 250 users and one year of sample data |
| Backup and restore drill | S | Restore completed and documented, including stored files |
| Privacy review | M | NDPA adviser confirms notices, processors, transfers and retention |
| Pilot | M | One department completes a full month, from request to closed report |

## 5. Order and release points

M0 → M1 → M2 → M3 → M4 → M5 → M6, with one vertical slice at a time.

| Release | After | Use |
|---|---|---|
| Internal preview | M2 | Set up the organisation |
| Alpha | M3 | Requests and payments with a few users |
| Beta | M4 | One department's monthly report |
| Pilot and launch | M6 | All departments |

## 6. Needed from the owner

| Item | Before |
|---|---|
| Development Supabase project | M1 (created) |
| First superadmin email, entered locally | M1 |
| Domain and Resend account with verified sender | M3 |
| Accountant's view of internal receipts | M4 |
| Sample report, if one becomes available | M4 |
| Claude API key, stored only in environment settings | M5 |
| Logo, colours, privacy adviser, production Supabase project | M6 |

## 7. Main risks

| Risk | Response |
|---|---|
| RLS mistakes | Isolation tests in CI; explicit grants |
| Templates do not match real reports | Versioned templates; pilot with real data |
| Too few approvers or payers | Setup checklist warnings |
| Poor receipt photos | Editable results and manual entry |
| Slow connections | Draft saving, image compression, upload retry |
| Internal receipts mistaken for vendor receipts | Fixed title, issuer and notice |
