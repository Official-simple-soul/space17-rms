# RMS: Detailed Schema Design

Status: agreed, 24 November 2026. Covers Foundation and MVP. Design only; no migrations exist yet. Read with [SCOPE.md](SCOPE.md).

## 1. Conventions

- `id` is `uuid`; timestamps are `timestamptz` in UTC; business dates are `date` in the organisation's timezone.
- Every table has `id`, `created_at`; mutable tables also have `updated_at`. These are not repeated below. Join tables use composite keys.
- Every tenant table has `org_id not null`. Child tables use composite foreign keys `(org_id, parent_id) → parent(org_id, id)`, so a row cannot reference another organisation.
- Actors are `membership_id`s, so history remains tied to the organisation.
- Money is `bigint` in minor units (kobo), in the organisation's currency. Quantity is `numeric(12,3)`.
- Statuses are text columns with check constraints.
- Submitted business records are never hard-deleted. Configuration is archived with `archived_at`.
- `?` means nullable.

## 2. Tables

### Platform

| Table | Columns | Rules |
|---|---|---|
| `organisations` | name, slug, logo_path?, currency (`NGN`), timezone (`Africa/Lagos`), fiscal_year_start_month, status, plan, limits jsonb, settings jsonb | slug unique; status: setup, active, suspended; currency fixed after first transaction |
| `platform_admins` | user_id | unique; managed outside the app |
| `org_invites` | email, token_hash, expires_at, accepted_at?, revoked_at?, created_org_id? | single-use; 7 days |
| `access_requests` | org_name, contact_name, email, message?, status | pending, invited, declined |
| `support_sessions` | org_id, admin_user_id, reason, starts_at, expires_at, ended_at? | read-only; maximum 2 hours; organisation admins are notified |

### People

| Table | Columns | Rules |
|---|---|---|
| `profiles` | user_id, full_name, phone?, avatar_path? | one per auth user |
| `memberships` | org_id, user_id, staff_no?, job_title?, primary_department_id?, status, signature_path? | unique (org, user); active, suspended, left |
| `member_bank_accounts` | org_id, membership_id, bank_name, account_name, account_number_encrypted, last4 | owner and authorised payers only; reads are audited |
| `departments` | org_id, name, code, parent_id?, archived_at? | code unique per organisation; no cycles |
| `department_members` | org_id, department_id, membership_id | unique pair |
| `invitations` | org_id, email, department_id?, role_id, token_hash, expires_at, accepted_at?, revoked_at?, invited_by | one open invitation per email per organisation |
| `join_codes` | org_id, code_hash, default_department_id?, expires_at, max_uses?, revoked_at? | off by default |
| `join_requests` | org_id, join_code_id, email, full_name, email_verified_at?, status, expires_at, reviewed_by? | unverified, pending, approved, rejected, expired; no auth user until approval |

### Access

| Table | Columns | Rules |
|---|---|---|
| `permissions` | key, description, allowed_scopes | global; seeded |
| `roles` | org_id, name, system_key?, archived_at? | defaults copied into each organisation |
| `role_permissions` | org_id, role_id, permission_key, scope | own, category, department, org |
| `membership_roles` | org_id, membership_id, role_id, department_id?, valid_from, valid_until?, granted_by | department-scoped grants require `department_id` |

HOD and deputy are `membership_roles` grants for a department. A deputy grant has an end date. This is the only record of who is HOD. A department has one active HOD.

### Configuration

| Table | Columns | Rules |
|---|---|---|
| `categories` | org_id, name, code, applies_to, template_id?, workflow_id?, archived_at? | applies_to: request, expense, both |
| `category_departments` | org_id, category_id, department_id | no rows means all departments |
| `category_approvers` | org_id, category_id, membership_id? or role_id?, department_id? | exactly one of member or role; still needs `requests.approve` |
| `templates` | org_id, kind, name, current_version_id?, archived_at? | kind: request, expense_report, narrative_report |
| `template_versions` | org_id, template_id, version, schema jsonb, published_at? | immutable once published |
| `workflows` | org_id, subject, name, current_version_id?, archived_at? | subject: request, report |
| `workflow_versions` | org_id, workflow_id, version, published_at? | immutable once published |
| `workflow_steps` | org_id, workflow_version_id, position, name, approver_type, role_id?, membership_id?, min_amount?, required_approvals (1) | approver_type: category_approvers, role, member; unique position |
| `number_sequences` | org_id, document_type, period_key, prefix, next_value | row locked when issuing a number |

A category without a workflow uses one `category_approvers` step with one approval.

### Requests and approvals

| Table | Columns | Rules |
|---|---|---|
| `requests` | org_id, number?, requester_id, department_id, category_id, template_version_id?, title, purpose, form_data jsonb, total_minor, approved_minor?, needed_by?, status, submitted_at?, closed_at?, lock_version | number assigned on submission |
| `request_items` | org_id, request_id, position, description, quantity, unit_price_minor, line_total_minor, approved_minor? | total recalculated on the server |
| `approval_runs` | org_id, request_id? or report_id?, workflow_version_id?, run_no, status | exactly one subject; new run on resubmission; one active run |
| `approval_steps` | org_id, run_id, position, rule jsonb, required_approvals, status | copied from the workflow at submission |
| `approval_step_approvers` | org_id, step_id, membership_id, delegated_from? | eligibility checked again when acting |
| `approval_actions` | org_id, step_id, membership_id, action, comment?, approved_minor? | append-only; one decision per person per step |

Comments are mandatory for return and reject. Amount changes may reduce but not raise the total.

### Reports and expenses

| Table | Columns | Rules |
|---|---|---|
| `report_periods` | org_id, month, due_date, status, closed_by?, closed_at? | unique (org, month); open, closed |
| `reports` | org_id, number?, kind, period_id, department_id, template_version_id?, status, submitted_by?, submitted_at?, approved_at?, summary?, lock_version | unique (kind, period, department) |
| `expense_lines` | org_id, entered_by, department_id, category_id, request_id?, report_id?, expense_date, description, seller_name, seller_location?, seller_phone?, quantity, unit_price_minor, total_minor, funding, paid_by_membership_id?, evidence_status, no_receipt_reason?, status, accepted_by?, lock_version | funding: department, personal; paid_by required for personal |
| `line_queries` | org_id, expense_line_id, raised_by, question, response?, responded_by?, status | open, answered, resolved |
| `report_adjustments` | org_id, report_id, expense_line_id?, amount_delta_minor, reason, created_by, approved_by? | creator cannot approve; original line never changes |

`evidence_status` is derived by the database: `vendor_receipt`, `internal_receipt`, `missing`. `seller_phone` is optional and only ever entered by a person; it is never generated.

### Payments and evidence

| Table | Columns | Rules |
|---|---|---|
| `payments` | org_id, number, request_id? or expense_line_id?, payee_membership_id?, payee_name, amount_minor, paid_on, method, reference?, status, recorded_by, void_reason? | exactly one target; recorded, voided |
| `payment_confirmations` | org_id, payment_id, confirmed_by, confirmed_at, note? | one per payment |
| `attachments` | org_id, subject columns?, kind, storage_path, mime, size, sha256, uploaded_by | exactly one subject: request, line, payment or report; vendor_receipt, purchase_photo, transfer_proof, acknowledgement, other |
| `internal_receipts` | org_id, number, expense_line_id, snapshot jsonb, pdf_path?, verify_token_hash, status, issued_by, issued_at, voided_by?, void_reason?, replaces_id? | one active per line; snapshot immutable; issued, voided |
| `ai_extractions` | org_id, attachment_id?, expense_line_id?, purpose, output jsonb, status, reviewed_by? | never writes directly to business records |

The internal receipt renderer reads only `snapshot`. The issuer is always the organisation, and the title and "vendor receipt unavailable" line are fixed in the template.

### Shared

| Table | Columns | Rules |
|---|---|---|
| `comments` | org_id, request_id? / report_id? / expense_line_id?, author_id, body | exactly one subject |
| `notifications` | org_id, membership_id, type, payload jsonb, read_at?, email_status? | |
| `audit_logs` | org_id?, actor_user_id?, action, entity_type, entity_id?, before jsonb?, after jsonb?, reason? | append-only; sensitive fields redacted |
| `ai_usage` | org_id, membership_id, feature, units, cost_estimate? | |
| `exports` | org_id, requested_by, kind, filters jsonb, status, storage_path?, expires_at? | background job; permission checked at request and download |

## 3. State transitions

Clients cannot update status columns. Each transition is a database function that locks the row, checks permission and separation rules, changes the data, then writes audit and notifications in one transaction.

### Request

| From | Action | To | Who |
|---|---|---|---|
| draft, returned | submit | pending | Requester |
| pending | withdraw | cancelled | Requester, before final approval |
| pending | return | returned | Current approver |
| pending | reject | rejected | Current approver |
| pending | final approval | approved | Current approver |
| approved, part_paid | record payment | part_paid or paid | Payer |
| paid | confirm receipt | received | Requester |
| received | account for spending | accounted | Automatic once linked lines are in an approved report |
| received, accounted | close | closed | Finance, or automatic for categories that need no accounting |

Non-monetary requests (`total_minor = 0`) go from approved to closed. Voiding a payment recalculates the request status and is blocked once accounted.

### Expense line

| From | Action | To | Who |
|---|---|---|---|
| draft, returned | submit | submitted | Enterer |
| submitted | accept | accepted, added to the report | HOD or deputy |
| submitted | return / reject | returned / rejected | HOD or deputy |
| accepted | remove before report submission | returned | HOD or deputy |
| accepted | report approved | locked | Automatic |

HODs may add their own lines directly as accepted. Finance still reviews them.

### Report

| From | Action | To | Who |
|---|---|---|---|
| draft, returned | submit | under_review | HOD or deputy |
| under_review | return | returned | Reviewer |
| under_review | approve | approved, lines locked | Reviewer, not the submitter |

"Overdue" is calculated, not stored. Submission warns about missing evidence. Approval is blocked while queries are open; approving with missing evidence requires a written reason. A period closes only when its reports are approved or explicitly waived with an audited reason.

Late expenses go into the next open period and keep their real expense date.

### Internal receipt

| From | Action | To | Conditions |
|---|---|---|---|
| none | issue | issued | Line accepted, no vendor receipt, reason given, issuer is not the enterer |
| issued | void | voided | Reason required; line becomes missing; blocked after the report is approved |
| voided | reissue | new issued row | New number, linked by `replaces_id` |

If a genuine vendor receipt is uploaded later, the internal receipt must be voided first.

## 4. Row Level Security

RLS is enabled on every table and denies by default.

| Helper | Returns |
|---|---|
| `is_member(org)` | Active membership in an active organisation |
| `has_perm(org, key, dept?, owner?, category?)` | Permission with matching scope and a currently valid grant |
| `has_support_access(org)` | Unexpired support session; used in select policies only |

| Table group | Read | Write |
|---|---|---|
| Organisation and departments | Members | Config permission |
| Roles, templates, workflows | Members | Config permission |
| Memberships and invitations | Members see names and departments; admins see all | Functions only |
| Requests and children | Own, department, assigned category or org scope | Requester while draft/returned; functions otherwise |
| Expense lines | Own, department or org scope | Enterer while draft/returned; functions otherwise |
| Reports | Department or org scope | Functions only |
| Payments, receipts, approvals | Follow parent visibility | Functions only |
| Bank accounts | Owner; authorised payer through audited function | Owner |
| Notifications | Recipient | Recipient marks read |
| Audit logs | `audit.view` | Nobody; functions insert |
| Platform tables | Superadmin | Superadmin or service functions |

- Users holding finance or admin permissions need an MFA session (`aal2`) for sensitive actions.
- Security-definer functions pin `search_path` and recheck the caller's identity. The service role is used only in server jobs and account creation.
- Public receipt verification returns only number, issuing organisation, date, total and status, and is rate limited.
- Storage paths start with `org_id/`; access follows the parent record.
- Account creation requires a valid invitation or approved join request; an auth hook rejects all others.
- An organisation cannot remove its last active admin.

## 5. Main permission keys

`org.manage`, `members.manage`, `roles.manage`, `config.manage`, `requests.create`, `requests.view`, `requests.approve`, `payments.record`, `payments.void`, `expenses.create`, `expenses.view`, `expenses.accept`, `reports.view`, `reports.submit`, `reports.review`, `receipts.issue`, `receipts.void`, `periods.close`, `exports.create`, `audit.view`

## 6. Key indexes

- `requests (org_id, status, submitted_at)`, `(org_id, requester_id)`, `(org_id, department_id, status)`
- `expense_lines (org_id, report_id)`, `(org_id, department_id, status)`, `(org_id, expense_date)`
- `approval_step_approvers (membership_id, step_id)`
- `payments (org_id, paid_on)`, `audit_logs (org_id, created_at desc)`
- `notifications (membership_id, created_at desc) where read_at is null`
- `attachments (org_id, sha256)` for duplicate detection

## 7. Required tests

1. A member of organisation A cannot read, write or reference organisation B's data.
2. Expired grants, suspended members and suspended organisations lose access immediately.
3. Self-approval, self-payment, report self-approval and receipt self-issue fail through every path.
4. Concurrent approvals and payments cannot double-apply or exceed the approved amount.
5. Locked lines, issued receipts and audit logs cannot be changed.
6. Support access is read-only and stops at expiry.
7. Sign-up without an invitation or approved join request fails.

## 8. Deferred

Budgets, cash advances, narrative report content and schedules, escalation, vendors and billing.
