-- Approval by department.
-- Requests and expenses are approved by the department's head or deputy, anyone given the Approver role for
-- that department, or an organisation admin as backup. One approval is enough and nobody approves their own.
-- Workflows, request and report templates, and per-category approvers are removed; categories become labels.

-- Permissions -------------------------------------------------------------------

-- Roles that approved by category now approve by department, or across the organisation if they already did.
insert into public.membership_roles (org_id, membership_id, role_id, department_id, valid_from, valid_until, granted_by)
select mr.org_id, mr.membership_id, mr.role_id, dm.department_id, mr.valid_from, mr.valid_until, mr.granted_by
from public.membership_roles mr
join public.department_members dm on dm.membership_id = mr.membership_id
where mr.department_id is null
  and exists (select 1 from public.role_permissions rp where rp.role_id = mr.role_id and rp.scope = 'category')
  and not exists (select 1 from public.role_permissions rp where rp.role_id = mr.role_id and rp.scope = 'org')
on conflict do nothing;
delete from public.membership_roles mr
where mr.department_id is null
  and exists (select 1 from public.role_permissions rp where rp.role_id = mr.role_id and rp.scope = 'category')
  and not exists (select 1 from public.role_permissions rp where rp.role_id = mr.role_id and rp.scope = 'org');
insert into public.role_permissions (org_id, role_id, permission_key, scope)
select rp.org_id, rp.role_id, rp.permission_key,
  case when exists (select 1 from public.role_permissions o where o.role_id = rp.role_id and o.scope = 'org')
    then 'org' else 'department' end
from public.role_permissions rp where rp.scope = 'category'
on conflict do nothing;
delete from public.role_permissions where scope = 'category';
alter table public.role_permissions drop constraint role_permissions_scope_check;
alter table public.role_permissions add constraint role_permissions_scope_check
  check (scope in ('own', 'department', 'org'));

update public.permissions set allowed_scopes = array_remove(allowed_scopes, 'category');
update public.permissions set allowed_scopes = '{department,org}' where key = 'expenses.accept';
update public.permissions set description = 'Manage categories' where key = 'config.manage';

-- Heads approve their department; admins are the backup for approving and reviewing.
insert into public.role_permissions (org_id, role_id, permission_key, scope)
select r.org_id, r.id, v.key, v.scope
from public.roles r
join (values
  ('admin', 'requests.approve', 'org'), ('admin', 'expenses.accept', 'org'), ('admin', 'reports.review', 'org'),
  ('hod', 'requests.approve', 'department'),
  ('approver', 'expenses.view', 'department'), ('approver', 'expenses.accept', 'department')
) as v (role_key, key, scope) on v.role_key = r.system_key
on conflict do nothing;

-- Approvals ---------------------------------------------------------------------

alter table public.approval_steps drop constraint approval_steps_approver_type_check;
alter table public.approval_steps add constraint approval_steps_approver_type_check
  check (approver_type in ('department', 'category_approvers', 'role', 'member'));
-- Requests already waiting finish under the new rule: one approval from the department.
update public.approval_steps set status = 'cancelled' where status = 'waiting';
update public.approval_steps set approver_type = 'department', role_id = null, membership_id = null, required_approvals = 1
  where status = 'active';
alter table public.approval_runs drop column workflow_version_id;

-- Requests and reports ----------------------------------------------------------

alter table public.requests add column preferred_supplier text not null default ''
  check (char_length(preferred_supplier) <= 120);
update public.requests set preferred_supplier = left(btrim(form_data ->> 'supplier'), 120)
  where jsonb_typeof(form_data -> 'supplier') = 'string';
alter table public.requests alter column category_id drop not null;
alter table public.requests drop column template_version_id, drop column form_data;

alter table public.reports add column summary text not null default '' check (char_length(summary) <= 5000);
update public.reports set summary = left(btrim(form_data ->> 'summary'), 5000)
  where jsonb_typeof(form_data -> 'summary') = 'string';
alter table public.reports drop column template_version_id, drop column form_data;

-- Categories are labels ---------------------------------------------------------

alter policy categories_read on public.categories using (app.is_member(org_id) or app.has_support_access(org_id));
drop trigger remove_leaver_approvals on public.memberships;
drop trigger guard_archive on public.roles;
drop table public.category_approvers;
drop table public.category_departments;
alter table public.categories drop column template_id, drop column workflow_id, drop column code,
  drop column applies_to, drop column requires_accounting;
-- Dropped together: versions and their parents refer to each other.
drop table public.workflow_steps, public.workflow_versions, public.workflows, public.template_versions, public.templates;

drop function app.sees_category(uuid, uuid);
drop function public.preview_steps(uuid, bigint);
drop function public.requestable_categories(uuid);
drop function app.steps_for(uuid, bigint);
drop function app.assert_form(jsonb, jsonb, uuid);
drop function app.has_category_perm(uuid, text, uuid, uuid);
drop function app.assigned_to_category(uuid, uuid, uuid, uuid);
drop function app.category_approvers_for;
drop function app.step_approvers;
drop function app.workflow_steps_json;
drop function app.category_json;
drop function public.save_template;
drop function public.archive_template;
drop function public.save_workflow;
drop function public.archive_workflow;
drop function app.report_template(uuid);
drop function app.guard_role_archive();
drop function app.remove_leaver_approvals();
drop function app.block_version_change();
drop function public.save_category;
drop function public.save_request(uuid, uuid, uuid, uuid, text, text, date, jsonb, jsonb, integer);
drop function public.save_report(uuid, integer, jsonb);
drop function public.setup_counts(uuid);
-- Only fed the old approver picker.
drop function public.list_approvers;

-- Who approves ------------------------------------------------------------------

-- Everyone who may approve a department's requests, apart from the person asking.
create function app.department_approvers(p_org uuid, p_department uuid, p_requester uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h from app.department_holders(p_org, 'requests.approve', p_department) h where h is distinct from p_requester
$$;

-- Who to alert: the people responsible for the department itself, or everyone able to act when there are none.
-- Keeps admins, the backup, from being told about every request in the organisation.
create function app.first_responders(p_people uuid[], p_org uuid, p_key text, p_department uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(array(
    select x from unnest(p_people) x where exists (
      select 1 from app.current_grants(p_org) g
      join public.role_permissions rp on rp.role_id = g.role_id and rp.permission_key = p_key and rp.scope = 'department'
      where g.membership_id = x and g.department_id = p_department)), '{}'), p_people)
$$;

create function app.in_my_department(p_org uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.department_members dm
    join public.departments d on d.id = dm.department_id and d.archived_at is null
    where dm.org_id = p_org and dm.department_id = p_department and dm.membership_id = app.membership_id(p_org))
$$;

-- Patched copies of existing functions ----------------------------------------

create or replace function app.can_view_request(p public.requests) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p.org_id);
begin
  if v_me = p.requester_id then return true; end if;
  if p.status = 'draft' then return false; end if;
  if app.has_support_access(p.org_id) then return true; end if;
  if v_me is null then return false; end if;
  return app.has_perm(p.org_id, 'requests.view', p.department_id)
    or (p.status in ('approved', 'part_paid', 'paid', 'received', 'accounted', 'closed')
      and (app.has_perm(p.org_id, 'payments.record') or app.has_perm(p.org_id, 'payments.void')))
    or exists (
      select 1 from public.approval_runs ru join public.approval_steps st on st.run_id = ru.id
      where ru.request_id = p.id and (
        exists (select 1 from public.approval_actions a where a.step_id = st.id and a.membership_id = v_me)
        or (st.status = 'active' and app.can_act(st.id, v_me))));
end $$;

create or replace function app.refresh_payment_status(p_request uuid) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_paid bigint := app.paid_minor(p_request); v_status text;
begin
  select * into v from public.requests where id = p_request;
  v_status := case
    when v_paid = 0 then 'approved'
    when v_paid < v.approved_minor then 'part_paid'
    when exists (select 1 from public.payments p where p.request_id = p_request and p.status = 'recorded'
      and not exists (select 1 from public.payment_confirmations c where c.payment_id = p.id)) then 'paid'
    else 'received' end;
  update public.requests set status = v_status, lock_version = lock_version + 1,
    closed_at = case when v_status = 'closed' then now() end
    where id = p_request returning * into v;
  return v;
end $$;

create or replace function app.run_step_approvers(p_step uuid, p_member uuid default null) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with s as (
    select st.*, r.department_id, r.category_id, r.requester_id
    from public.approval_steps st
    join public.approval_runs ru on ru.id = st.run_id
    join public.requests r on r.id = ru.request_id
    where st.id = p_step
  ), grants as materialized (
    select g.* from s cross join lateral app.current_grants(s.org_id) g
    where p_member is null or g.membership_id = p_member
  ), holders as (
    select distinct g.membership_id from grants g cross join s
    join public.role_permissions rp on rp.role_id = g.role_id and rp.permission_key = 'requests.approve'
    where (rp.scope = 'org' and g.department_id is null) or (rp.scope = 'department' and g.department_id = s.department_id)
  )
  select h.membership_id from holders h cross join s
  where h.membership_id <> s.requester_id and case s.approver_type
    when 'member' then h.membership_id = s.membership_id
    when 'role' then exists (select 1 from grants g where g.membership_id = h.membership_id and g.role_id = s.role_id
      and (g.department_id is null or g.department_id = s.department_id))
    else true end
$$;

create or replace function app.step_label(p_type text, p_role uuid, p_member uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case p_type when 'role' then (select name from public.roles where id = p_role)
    when 'member' then app.member_name(p_member) else 'Department approvers' end
$$;

create or replace function app.activate_step(p_step uuid, p public.requests) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.approval_steps set status = 'active', activated_at = now() where id = p_step;
  perform app.notify(p.org_id, app.first_responders(array(select app.run_step_approvers(p_step)), p.org_id, 'requests.approve', p.department_id), 'approval_needed', p.id, app.request_payload(p));
end $$;

create or replace function app.sees_all_departments(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.sees_directory(p_org) or exists (
    select 1 from app.current_grants(p_org) g
    join public.role_permissions rp on rp.role_id = g.role_id
    where g.membership_id = app.membership_id(p_org) and rp.scope = 'org' and g.department_id is null
      and rp.permission_key in ('requests.view', 'requests.approve', 'expenses.view', 'reports.view',
        'reports.review', 'payments.record', 'payments.void'))
$$;

create or replace function app.guard_department_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.expense_lines e where e.department_id = new.id and e.status in ('submitted', 'accepted'))
    or exists (select 1 from public.reports r where r.department_id = new.id and r.status in ('under_review', 'returned')) then
    raise exception 'department_has_expenses' using errcode = '22023';
  end if;
  return new;
end $$;

create or replace function public.list_requests(
  p_org uuid, p_view text default 'mine', p_search text default '', p_status text default null,
  p_category uuid default null, p_department uuid default null, p_sort text default null, p_desc boolean default false,
  p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, number text, title text, requester text, category text, department text, status text,
  total_minor bigint, approved_minor bigint, submitted_at timestamptz, waiting_since timestamptz, updated_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org); v_all boolean;
begin
  v_all := app.has_perm(p_org, 'requests.view') or app.has_support_access(p_org);
  if v_me is null and not v_all then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  with found as (
    select r.*, coalesce(c.name, '') as category_name, coalesce(d.name, '') as department_name, app.member_name(r.requester_id) as who, st.activated_at
    from public.requests r
    left join public.categories c on c.id = r.category_id
    left join public.departments d on d.id = r.department_id
    left join public.approval_runs ru on ru.request_id = r.id and ru.status = 'active'
    left join public.approval_steps st on st.run_id = ru.id and st.status = 'active'
    where r.org_id = p_org
      and (p_status is null or r.status = p_status)
      and (p_category is null or r.category_id = p_category)
      and (p_department is null or r.department_id = p_department)
      and case p_view
        when 'mine' then r.requester_id = v_me
        when 'inbox' then r.status = 'pending' and st.id is not null and app.can_act(st.id, v_me)
        when 'all' then r.status <> 'draft' and (v_all or app.can_view_request(r))
        else false end
  )
  select f.id, f.number, f.title, f.who, f.category_name, f.department_name, f.status, f.total_minor, f.approved_minor,
    f.submitted_at, f.activated_at, f.updated_at, count(*) over ()
  from found f
  where app.matches(concat_ws(' ', f.number, f.title, f.who, f.category_name, f.department_name), p_search)
  order by
    case when p_sort = 'amount' and not p_desc then f.total_minor end asc,
    case when p_sort = 'amount' and p_desc then f.total_minor end desc,
    case when p_sort in ('title', 'requester', 'category', 'status') and not p_desc then lower(case p_sort
      when 'title' then f.title when 'requester' then f.who when 'category' then f.category_name else f.status end) end asc,
    case when p_sort in ('title', 'requester', 'category', 'status') and p_desc then lower(case p_sort
      when 'title' then f.title when 'requester' then f.who when 'category' then f.category_name else f.status end) end desc,
    case when p_sort = 'date' and not p_desc then coalesce(f.submitted_at, f.created_at) end asc,
    case when p_sort is null and p_view = 'inbox' then f.activated_at end asc,
    coalesce(f.submitted_at, f.created_at) desc, f.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.expense_categories(p_org uuid)
returns table (id uuid, name text, departments uuid[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_perm(p_org, 'expenses.create', null, app.membership_id(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, array_agg(dm.department_id)
  from public.categories c
  join public.department_members dm on dm.org_id = p_org and dm.membership_id = app.membership_id(p_org)
  join public.departments d on d.id = dm.department_id and d.archived_at is null
  where c.org_id = p_org and c.archived_at is null
  group by c.id, c.name order by c.name;
end $$;

create or replace function public.submit_expense(p_id uuid, p_lock integer) returns text
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines; v_dept uuid; v_today date;
begin
  select department_id into v_dept from public.expense_lines where id = p_id;
  if v_dept is not null then perform app.lock_department(v_dept); end if;
  v := app.lock_own_expense(p_id, p_lock);
  if not app.has_perm(v.org_id, 'expenses.create', null, v.entered_by) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v.status not in ('draft', 'returned') then raise exception 'expense_locked' using errcode = '22023'; end if;
  if v.department_id is null then raise exception 'department_missing' using errcode = '22023'; end if;
  if not exists (select 1 from public.expense_categories(v.org_id) c
    where c.id = v.category_id and v.department_id = any (c.departments)) then
    raise exception 'category_unavailable' using errcode = '22023';
  end if;
  v_today := app.today(v.org_id);
  if v.expense_date is null or v.expense_date > v_today or v.expense_date < v_today - 366 then
    raise exception 'invalid_expense_date' using errcode = '22023';
  end if;
  if char_length(v.description) < 3 or char_length(v.seller_name) < 2
    or v.seller_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'expense_incomplete' using errcode = '22023';
  end if;
  if v.total_minor <= 0 or exists (select 1 from public.expense_items i where i.expense_line_id = p_id
    and (char_length(i.description) < 2 or i.quantity <= 0 or i.unit_price_minor <= 0)) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if v.request_id is not null and not exists (select 1 from public.linkable_requests(v.org_id) r
    where r.id = v.request_id and r.department_id = v.department_id) then
    raise exception 'request_unavailable' using errcode = '22023';
  end if;
  if v.no_receipt then
    if app.has_vendor_receipt(p_id) then raise exception 'receipt_conflict' using errcode = '22023'; end if;
    if char_length(coalesce(v.no_receipt_reason, '')) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  elsif not app.has_vendor_receipt(p_id) then
    raise exception 'receipt_required' using errcode = '22023';
  end if;
  if not exists (select 1 from app.department_holders(v.org_id, 'reports.submit', v.department_id)) then
    raise exception 'no_head' using errcode = '22023';
  end if;
  update public.expense_lines set status = 'submitted', submitted_at = now(), lock_version = lock_version + 1
    where id = p_id returning * into v;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type) values (v.org_id, p_id, v.entered_by, 'submitted');
  perform app.write_audit(v.org_id, 'expense.submitted', 'expense', p_id, null, jsonb_build_object('total_minor', v.total_minor));
  -- A head's own lines go straight into the report; Finance still reviews them.
  if app.has_perm(v.org_id, 'expenses.accept', v.department_id) then
    perform app.accept_line(v);
    return 'accepted';
  end if;
  perform app.notify_about(v.org_id, app.first_responders(array(select app.department_holders(v.org_id, 'expenses.accept', v.department_id)),
      v.org_id, 'expenses.accept', v.department_id),
    'expense_submitted', p_id, null, app.expense_payload(v));
  return 'submitted';
end $$;

create or replace function public.start_attachment(p_request uuid, p_field text, p_name text, p_mime text, p_size integer)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_id uuid := gen_random_uuid(); v_path text;
begin
  select * into v from public.requests where id = p_request for update;
  if v.id is null or v.requester_id is distinct from app.membership_id(v.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.status not in ('draft', 'returned') then raise exception 'request_locked' using errcode = '22023'; end if;
  if (select count(*) from public.attachments where request_id = p_request and removed_at is null
    and (ready_at is not null or created_at > now() - interval '15 minutes')) >= 20 then
    raise exception 'too_many_files' using errcode = '22023';
  end if;
  if p_field is not null and p_field <> 'quotation' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_path := v.org_id || '/requests/' || p_request || '/' || v_id;
  insert into public.attachments (id, org_id, request_id, field_key, storage_path, file_name, mime, size, uploaded_by)
    values (v_id, v.org_id, p_request, p_field, v_path, right(btrim(p_name), 160), p_mime, p_size, v.requester_id);
  return jsonb_build_object('id', v_id, 'path', v_path);
end $$;

create or replace function public.start_report_file(p_report uuid, p_field text, p_name text, p_mime text, p_size integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.reports; v_id uuid := gen_random_uuid(); v_path text;
begin
  select * into v from public.reports where id = p_report for update;
  if v.id is null or not app.can_view_report(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not app.can_edit_report(v) then raise exception 'report_locked' using errcode = '22023'; end if;
  if (select count(*) from public.attachments where report_id = p_report and removed_at is null
    and (ready_at is not null or created_at > now() - interval '15 minutes')) >= 20 then
    raise exception 'too_many_files' using errcode = '22023';
  end if;
  if p_field is not null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_path := v.org_id || '/reports/' || p_report || '/' || v_id;
  insert into public.attachments (id, org_id, report_id, field_key, storage_path, file_name, mime, size, uploaded_by)
    values (v_id, v.org_id, p_report, p_field, v_path, right(btrim(p_name), 160), p_mime, p_size, app.membership_id(v.org_id));
  return jsonb_build_object('id', v_id, 'path', v_path);
end $$;

create or replace function public.submit_report(p_id uuid, p_lock integer, p_confirm_missing boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.reports; pe public.report_periods; v_me uuid; v_total bigint; v_missing bigint; v_name text;
begin
  v := app.lock_report(p_id, p_lock);
  v_me := app.membership_id(v.org_id);
  select * into pe from public.report_periods where id = v.period_id;
  if pe.month > app.today(v.org_id) then raise exception 'invalid_month' using errcode = '22023'; end if;
  select coalesce(sum(total_minor), 0), count(*) filter (where app.evidence_of(id) = 'missing') into v_total, v_missing
    from public.expense_lines where report_id = p_id;
  if v_missing > 0 and not coalesce(p_confirm_missing, false) then raise exception 'missing_evidence' using errcode = '22023'; end if;
  -- Someone other than the submitter must be able to review it.
  if not exists (select 1 from app.department_holders(v.org_id, 'reports.review', v.department_id) h where h <> v_me) then
    raise exception 'no_reviewer' using errcode = '22023';
  end if;
  update public.reports set status = 'under_review', number = coalesce(number, app.next_number(org_id, 'report')),
    submitted_by = v_me, submitted_at = now(), lock_version = lock_version + 1 where id = p_id returning * into v;
  insert into public.report_events (org_id, report_id, actor_id, type, body) values (v.org_id, p_id, v_me, 'submitted',
    case when v_missing > 0 then v_missing || ' without a receipt' end);
  select name into v_name from public.departments where id = v.department_id;
  perform app.notify_about(v.org_id, array(select app.department_holders(v.org_id, 'reports.review', v.department_id)),
    'report_submitted', null, p_id, jsonb_build_object('number', v.number,
      'title', v_name || ', ' || to_char(pe.month, 'FMMonth YYYY'), 'actor', app.member_name(v_me)));
  perform app.write_audit(v.org_id, 'report.submitted', 'report', p_id, null,
    jsonb_build_object('number', v.number, 'total_minor', v_total, 'missing', v_missing));
end $$;

create or replace function public.get_report(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.reports; pe public.report_periods; v_edit boolean; v_lines jsonb;
begin
  select * into v from public.reports where id = p_id;
  if v.id is null or not app.can_view_report(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into pe from public.report_periods where id = v.period_id;
  v_edit := app.can_edit_report(v);
  select coalesce(jsonb_agg(app.expense_row(e) order by e.expense_date, e.created_at), '[]'::jsonb) into v_lines
    from public.expense_lines e where e.report_id = p_id;
  return jsonb_build_object(
    'id', v.id, 'org_id', v.org_id, 'number', v.number, 'status', v.status, 'lock_version', v.lock_version,
    'month', pe.month, 'due_date', pe.due_date, 'period_status', pe.status,
    'overdue', v.status in ('draft', 'returned') and pe.due_date < app.today(v.org_id),
    'started', pe.month <= app.today(v.org_id),
    'month_over', (pe.month + interval '1 month')::date <= app.today(v.org_id),
    'department', (select jsonb_build_object('id', id, 'name', name) from public.departments where id = v.department_id),
    'currency', (select currency from public.organisations where id = v.org_id),
    'submitted_by', case when v.submitted_by is not null then app.member_name(v.submitted_by) end, 'submitted_at', v.submitted_at,
    'summary', v.summary, 'lines', v_lines,
    'attachments', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime, 'size', a.size,
      'field_key', a.field_key) order by a.created_at), '[]'::jsonb) from public.attachments a
      where a.report_id = p_id and a.ready_at is not null and a.removed_at is null),
    'waiting', (select count(*) from public.expense_lines e where e.department_id = v.department_id and e.status = 'submitted'
      and app.can_view_expense(e)),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'actor', app.member_name(e.actor_id),
      'body', e.body, 'at', e.created_at) order by e.id desc), '[]'::jsonb) from public.report_events e where e.report_id = p_id),
    'can_edit', v_edit);
end $$;

create or replace function app.request_json(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.requests; v_me uuid; v_run uuid; v_active uuid; v_steps jsonb;
begin
  v := app.get_visible_request(p_id);
  v_me := app.membership_id(v.org_id);
  select id into v_run from public.approval_runs where request_id = p_id order by run_no desc limit 1;
  select st.id into v_active from public.approval_steps st where st.run_id = v_run and st.status = 'active';
  if v_run is not null then
    select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'status', st.status,
      'who', app.step_label(st.approver_type, st.role_id, st.membership_id), 'required', st.required_approvals,
      'approved', (select count(*) from public.approval_actions a where a.step_id = st.id and a.action = 'approve'),
      'people', case when st.status = 'active' then (select coalesce(jsonb_agg(app.member_name(x) order by app.member_name(x)), '[]'::jsonb)
        from unnest(app.first_responders(array(select app.run_step_approvers(st.id)), v.org_id, 'requests.approve',
          v.department_id)) x where not exists (
          select 1 from public.approval_actions a where a.step_id = st.id and a.membership_id = x)) else '[]'::jsonb end
      ) order by st.position) into v_steps from public.approval_steps st where st.run_id = v_run;
  end if;
  return jsonb_build_object(
    'id', v.id, 'org_id', v.org_id, 'number', v.number, 'title', v.title, 'purpose', v.purpose, 'status', v.status,
    'total_minor', v.total_minor, 'approved_minor', v.approved_minor, 'needed_by', v.needed_by,
    'submitted_at', v.submitted_at, 'created_at', v.created_at, 'lock_version', v.lock_version,
    'currency', (select currency from public.organisations where id = v.org_id),
    'category', (select jsonb_build_object('id', id, 'name', name) from public.categories where id = v.category_id),
    'department', (select jsonb_build_object('id', id, 'name', name) from public.departments where id = v.department_id),
    'requester', app.member_name(v.requester_id),
    'supplier', v.preferred_supplier,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'description', i.description, 'quantity', i.quantity,
      'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor, 'approved_minor', i.approved_minor)
      order by i.position), '[]'::jsonb) from public.request_items i where i.request_id = p_id),
    'attachments', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime,
      'size', a.size, 'field_key', a.field_key) order by a.created_at), '[]'::jsonb) from public.attachments a
      where a.request_id = p_id and a.ready_at is not null and a.removed_at is null),
    'steps', coalesce(v_steps, '[]'::jsonb),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'actor', app.member_name(e.actor_id),
      'step', e.step_name, 'body', e.body, 'amount_minor', e.amount_minor, 'at', e.created_at) order by e.id desc), '[]'::jsonb)
      from public.request_events e where e.request_id = p_id),
    'is_requester', coalesce(v_me = v.requester_id, false),
    'my_step', case when v_active is not null and app.can_act(v_active, v_me) then v_active end,
    'active_step', v_active,
    'can_comment', v_me is not null and v.status <> 'draft',
    'already_decided', v_active is not null and exists (
      select 1 from public.approval_actions a where a.step_id = v_active and a.membership_id = v_me)
  );
end $$;

create or replace function app.seed_roles(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.roles (org_id, name, system_key) values
    (p_org, 'Organisation admin', 'admin'),
    (p_org, 'Finance', 'finance'),
    (p_org, 'Approver', 'approver'),
    (p_org, 'Auditor', 'auditor'),
    (p_org, 'Head of department', 'hod'),
    (p_org, 'Staff', 'staff');

  insert into public.role_permissions (org_id, role_id, permission_key, scope)
  select p_org, r.id, v.key, v.scope
  from (values
    ('admin', 'org.manage', 'org'), ('admin', 'members.manage', 'org'),
    ('admin', 'roles.manage', 'org'), ('admin', 'config.manage', 'org'),
    ('admin', 'requests.view', 'org'), ('admin', 'expenses.view', 'org'),
    ('admin', 'reports.view', 'org'), ('admin', 'exports.create', 'org'),
    ('admin', 'audit.view', 'org'), ('admin', 'requests.approve', 'org'), ('admin', 'expenses.accept', 'org'),
    ('admin', 'reports.review', 'org'),
    ('finance', 'requests.view', 'org'), ('finance', 'payments.record', 'org'),
    ('finance', 'payments.void', 'org'), ('finance', 'expenses.view', 'org'),
    ('finance', 'reports.view', 'org'), ('finance', 'reports.review', 'org'),
    ('finance', 'receipts.issue', 'org'), ('finance', 'receipts.void', 'org'),
    ('finance', 'periods.close', 'org'), ('finance', 'exports.create', 'org'),
    ('approver', 'requests.view', 'department'), ('approver', 'requests.approve', 'department'),
    ('approver', 'expenses.view', 'department'), ('approver', 'expenses.accept', 'department'),
    ('auditor', 'requests.view', 'org'), ('auditor', 'expenses.view', 'org'),
    ('auditor', 'reports.view', 'org'), ('auditor', 'exports.create', 'org'),
    ('auditor', 'audit.view', 'org'),
    ('hod', 'requests.view', 'department'), ('hod', 'requests.approve', 'department'), ('hod', 'expenses.view', 'department'),
    ('hod', 'expenses.accept', 'department'), ('hod', 'reports.view', 'department'),
    ('hod', 'reports.submit', 'department'), ('hod', 'exports.create', 'department')
  ) as v (role_key, key, scope)
  join public.roles r on r.org_id = p_org and r.system_key = v.role_key;

  insert into public.role_permissions (org_id, role_id, permission_key, scope)
  select p_org, r.id, k, 'own'
  from public.roles r
  cross join unnest(array['requests.create', 'requests.view', 'expenses.create', 'expenses.view']) as k
  where r.org_id = p_org and r.system_key in ('admin', 'finance', 'approver', 'hod', 'staff');
end $$;

-- Requests ----------------------------------------------------------------------

-- What the request form needs: the caller's departments with who will approve, and the category labels.
create function public.request_options(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org);
begin
  if not app.has_perm(p_org, 'requests.create', null, v_me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'departments', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name,
        'approvers', (select coalesce(jsonb_agg(app.member_name(x) order by app.member_name(x)), '[]'::jsonb)
          from unnest(app.first_responders(array(select app.department_approvers(p_org, d.id, v_me)),
            p_org, 'requests.approve', d.id)) x)
      ) order by d.name), '[]'::jsonb)
      from public.department_members dm join public.departments d on d.id = dm.department_id and d.archived_at is null
      where dm.org_id = p_org and dm.membership_id = v_me),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::jsonb)
      from public.categories c where c.org_id = p_org and c.archived_at is null));
end $$;

-- p_items: ordered [{description, quantity, unit_price_minor}]. Drafts may be incomplete.
create function public.save_request(
  p_org uuid, p_id uuid, p_department uuid, p_category uuid, p_title text, p_purpose text,
  p_needed_by date, p_supplier text, p_items jsonb, p_lock integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org); v public.requests; v_id uuid := p_id; v_total numeric;
begin
  if not app.has_perm(p_org, 'requests.create', null, v_me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_department is not null and not app.in_my_department(p_org, p_department) then
    raise exception 'department_unavailable' using errcode = '22023';
  end if;
  if p_category is not null and not exists (select 1 from public.categories
    where org_id = p_org and id = p_category and archived_at is null) then
    raise exception 'category_unavailable' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.requests (org_id, requester_id) values (p_org, v_me) returning id into v_id;
  else
    v := app.lock_own_request(p_id, p_lock);
    if v.org_id <> p_org or v.status not in ('draft', 'returned') then
      raise exception 'request_locked' using errcode = '22023';
    end if;
    delete from public.request_items where request_id = p_id;
  end if;
  insert into public.request_items (org_id, request_id, position, description, quantity, unit_price_minor)
  select p_org, v_id, i.n, btrim(coalesce(i.description, '')), coalesce(i.quantity, 0), coalesce(i.unit_price_minor, 0)
  from rows from (jsonb_to_recordset(p_items) as (description text, quantity numeric, unit_price_minor bigint))
    with ordinality as i (description, quantity, unit_price_minor, n);
  select coalesce(sum(line_total_minor), 0) into v_total from public.request_items where request_id = v_id;
  if v_total > 900000000000000 then raise exception 'invalid_items' using errcode = '22023'; end if;
  update public.requests set category_id = p_category, department_id = p_department,
    title = btrim(coalesce(p_title, '')), purpose = btrim(coalesce(p_purpose, '')), needed_by = p_needed_by,
    preferred_supplier = left(btrim(coalesce(p_supplier, '')), 120), total_minor = v_total::bigint, approved_minor = null,
    lock_version = case when p_id is null then 1 else lock_version + 1 end
    where id = v_id returning * into v;
  return jsonb_build_object('id', v_id, 'version', v.lock_version);
end $$;

create or replace function public.submit_request(p_id uuid, p_lock integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_me uuid; v_run uuid; v_step uuid;
begin
  v := app.lock_own_request(p_id, p_lock);
  v_me := v.requester_id;
  if not app.has_perm(v.org_id, 'requests.create', null, v_me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v.status not in ('draft', 'returned') then raise exception 'request_locked' using errcode = '22023'; end if;
  perform app.lock_org(v.org_id);
  if v.department_id is null then raise exception 'department_missing' using errcode = '22023'; end if;
  if not app.in_my_department(v.org_id, v.department_id) then
    raise exception 'department_unavailable' using errcode = '22023';
  end if;
  if v.category_id is not null and not exists (select 1 from public.categories
    where id = v.category_id and archived_at is null) then
    raise exception 'category_unavailable' using errcode = '22023';
  end if;
  if char_length(v.title) < 2 or char_length(v.purpose) < 2 then
    raise exception 'request_incomplete' using errcode = '22023';
  end if;
  if exists (select 1 from public.request_items i where i.request_id = p_id
    and (char_length(i.description) < 2 or i.quantity <= 0 or i.unit_price_minor <= 0)) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if v.total_minor <= 0 then raise exception 'amount_missing' using errcode = '22023'; end if;
  -- Fail now rather than leave a request nobody can decide.
  if not exists (select 1 from app.department_approvers(v.org_id, v.department_id, v_me)) then
    raise exception 'no_approver' using errcode = '22023';
  end if;

  update public.requests set status = 'pending', number = coalesce(number, app.next_number(org_id, 'request')),
    submitted_at = now(), decided_at = null, approved_minor = null, lock_version = lock_version + 1
    where id = p_id returning * into v;
  update public.request_items set approved_minor = null where request_id = p_id;
  insert into public.approval_runs (org_id, request_id, run_no, snapshot)
  select v.org_id, p_id, (select count(*) + 1 from public.approval_runs where request_id = p_id),
    jsonb_build_object('title', v.title, 'purpose', v.purpose, 'department_id', v.department_id,
      'category_id', v.category_id, 'needed_by', v.needed_by, 'supplier', v.preferred_supplier, 'total_minor', v.total_minor,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('description', i.description, 'quantity', i.quantity,
        'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor) order by i.position), '[]'::jsonb)
        from public.request_items i where i.request_id = p_id),
      'attachments', (select coalesce(jsonb_agg(a.id order by a.created_at), '[]'::jsonb) from public.attachments a
        where a.request_id = p_id and a.ready_at is not null and a.removed_at is null))
  returning id into v_run;
  insert into public.approval_steps (org_id, run_id, position, name, approver_type, required_approvals)
    values (v.org_id, v_run, 1, 'Approval', 'department', 1) returning id into v_step;
  insert into public.request_events (org_id, request_id, actor_id, type, amount_minor)
    values (v.org_id, p_id, v_me, 'submitted', v.total_minor);
  perform app.activate_step(v_step, v);
  perform app.write_audit(v.org_id, 'request.submitted', 'request', p_id, null,
    jsonb_build_object('number', v.number, 'total_minor', v.total_minor));
  return jsonb_build_object('id', p_id, 'version', v.lock_version);
end $$;

-- Reports -----------------------------------------------------------------------

create function public.save_report(p_id uuid, p_lock integer, p_summary text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.reports;
begin
  v := app.lock_report(p_id, p_lock);
  update public.reports set summary = left(btrim(coalesce(p_summary, '')), 5000), lock_version = lock_version + 1
    where id = p_id returning * into v;
  return jsonb_build_object('id', p_id, 'version', v.lock_version);
end $$;

-- Categories --------------------------------------------------------------------

create function public.save_category(p_org uuid, p_id uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_before text; v_name text := btrim(coalesce(p_name, ''));
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if exists (select 1 from public.categories where org_id = p_org and archived_at is null
    and lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'category_exists' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.categories (org_id, name) values (p_org, v_name) returning id into v_id;
  else
    select name into v_before from public.categories where org_id = p_org and id = p_id and archived_at is null;
    if v_before is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    update public.categories set name = v_name where id = p_id;
  end if;
  perform app.write_audit(p_org, case when p_id is null then 'category.created' else 'category.updated' end, 'category', v_id,
    case when v_before is not null then jsonb_build_object('name', v_before) end, jsonb_build_object('name', v_name));
  return v_id;
end $$;

create or replace function public.add_starter_configuration(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if exists (select 1 from public.categories where org_id = p_org) then
    raise exception 'already_configured' using errcode = '22023';
  end if;
  perform public.save_category(p_org, null, n) from unnest(array['Food and kitchen', 'Repairs and maintenance',
    'Transport', 'Supplies', 'Health', 'School and learning', 'Other']) as n;
end $$;

-- Setup -------------------------------------------------------------------------

create function public.setup_counts(p_org uuid)
returns table (members bigint, departments bigint, roles bigint, categories bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  -- Counts of people and departments are for those who manage or oversee them.
  if not app.sees_directory(p_org) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select
    (select count(*) from public.memberships x where x.org_id = p_org and x.status <> 'left'),
    (select count(*) from public.departments x where x.org_id = p_org and x.archived_at is null),
    (select count(*) from public.roles x where x.org_id = p_org and x.archived_at is null),
    (select count(*) from public.categories x where x.org_id = p_org and x.archived_at is null);
end $$;

create or replace function public.setup_warnings(p_org uuid)
returns table (code text, subject_id uuid, subject text, found integer, needed integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_perm(p_org, 'config.manage') or app.has_perm(p_org, 'org.manage')
    or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with active_departments as (
    select d.id, d.name from public.departments d where d.org_id = p_org and d.archived_at is null
  )
  -- Two, because nobody approves their own request.
  select 'department_approvers', d.id, d.name, n.found, 2
  from active_departments d
  cross join lateral (select count(*)::integer as found from app.department_holders(p_org, 'requests.approve', d.id)) n
  where n.found < 2
  union all
  select 'payers', null, null, n.found, 2
  from (select count(*)::integer as found from app.permission_holders(p_org, 'payments.record')) n where n.found < 2
  union all
  select 'department_head', d.id, d.name, 0, 1 from active_departments d
  where not exists (
    select 1 from app.current_grants(p_org) g join public.roles r on r.id = g.role_id and r.system_key = 'hod'
    where g.department_id = d.id);
end $$;

-- Grants ------------------------------------------------------------------------

revoke execute on all functions in schema app from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'request_options(uuid)', 'save_request(uuid, uuid, uuid, uuid, text, text, date, text, jsonb, integer)',
    'save_report(uuid, integer, text)', 'save_category(uuid, uuid, text)', 'setup_counts(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
