-- Closing the month.
-- Finance sees every department's report for a month. A department with nothing to report is excused ("waived") with a
-- reason. When every report is approved or waived, the month closes: its lines are locked and no expense can join it.
-- A closed month can be reopened with a reason. After approval, a report is corrected only by an adjustment that a
-- second person approves.

alter table public.reports drop constraint reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('draft', 'under_review', 'returned', 'approved', 'waived'));
alter table public.reports drop constraint reports_check;
alter table public.reports add constraint reports_check
  check (status in ('draft', 'waived') or (number is not null and submitted_by is not null and submitted_at is not null));

alter table public.report_events drop constraint report_events_type_check;
alter table public.report_events add constraint report_events_type_check
  check (type in ('submitted', 'returned', 'approved', 'waived', 'adjustment_proposed', 'adjustment_approved',
    'adjustment_rejected'));

alter table public.report_periods add column closed_by uuid, add column closed_at timestamptz,
  add constraint report_periods_closed_by_fkey foreign key (org_id, closed_by) references public.memberships (org_id, id),
  add constraint report_periods_closed_check check ((status = 'closed') = (closed_at is not null and closed_by is not null));

create table public.period_events (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  period_id uuid not null,
  actor_id uuid not null,
  type text not null check (type in ('closed', 'reopened')),
  body text check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  foreign key (org_id, period_id) references public.report_periods (org_id, id),
  foreign key (org_id, actor_id) references public.memberships (org_id, id)
);
create trigger period_events_append_only before update or delete on public.period_events
  for each row execute function app.block_mutation();
alter table public.period_events enable row level security;
revoke all on public.period_events from anon, authenticated;

create table public.report_adjustments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  report_id uuid not null,
  -- Positive adds to the report's total, negative takes away.
  amount_minor bigint not null check (amount_minor <> 0 and abs(amount_minor) <= 900000000000000),
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  proposed_by uuid not null,
  proposed_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 500),
  unique (org_id, id),
  foreign key (org_id, report_id) references public.reports (org_id, id),
  foreign key (org_id, proposed_by) references public.memberships (org_id, id),
  foreign key (org_id, decided_by) references public.memberships (org_id, id),
  check ((status = 'proposed') = (decided_by is null)),
  check (decided_by is distinct from proposed_by)
);
create index report_adjustments_report_idx on public.report_adjustments (report_id);
alter table public.report_adjustments enable row level security;
revoke all on public.report_adjustments from anon, authenticated;

-- The departments that owe a report for a month: active ones, and any that already have a report for it.
create function app.month_departments(p_org uuid, p_month date) returns table (department_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.name from public.departments d
  join public.organisations o on o.id = p_org
  where d.org_id = p_org and (
    (d.archived_at is null and (d.created_at at time zone o.timezone)::date < (p_month + interval '1 month')::date)
    or exists (select 1 from public.reports r join public.report_periods pe on pe.id = r.period_id
      where r.department_id = d.id and pe.org_id = p_org and pe.month = p_month))
$$;

-- Finance's checklist for a month.
create function public.month_checklist(p_org uuid, p_month date)
returns table (department_id uuid, department text, report_id uuid, number text, status text, total_minor bigint,
  lines bigint, missing bigint, waiting bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'periods.close');
  if p_month is null or extract(day from p_month) <> 1 then raise exception 'invalid_month' using errcode = '22023'; end if;
  return query
  select m.department_id, m.name, r.id, r.number, coalesce(r.status, 'missing'),
    coalesce((select sum(e.total_minor) from public.expense_lines e where e.report_id = r.id), 0)::bigint,
    (select count(*) from public.expense_lines e where e.report_id = r.id),
    (select count(*) from public.expense_lines e where e.report_id = r.id and app.evidence_of(e.id) = 'missing'),
    (select count(*) from public.expense_lines e where e.department_id = m.department_id and e.status = 'submitted'
      and e.expense_date >= p_month and e.expense_date < (p_month + interval '1 month')::date)
  from app.month_departments(p_org, p_month) m
  left join public.report_periods pe on pe.org_id = p_org and pe.month = p_month
  left join public.reports r on r.period_id = pe.id and r.department_id = m.department_id and r.kind = 'expense'
  order by m.name;
end $$;

-- The months Finance can look at: recent ones, and whether each is closed.
create function public.list_periods(p_org uuid)
returns table (month date, status text, closed_by text, closed_at timestamptz, departments bigint, settled bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_now date := date_trunc('month', app.today(p_org))::date;
begin
  perform app.require_perm(p_org, 'periods.close');
  return query
  select m.month::date, coalesce(pe.status, 'open'), case when pe.closed_by is not null then app.member_name(pe.closed_by) end,
    pe.closed_at,
    (select count(*) from app.month_departments(p_org, m.month::date)),
    (select count(*) from app.month_departments(p_org, m.month::date) d join public.reports r on r.department_id = d.department_id
      and r.period_id = pe.id and r.status in ('approved', 'waived'))
  from generate_series((v_now - interval '6 months')::date, (v_now - interval '1 month')::date, interval '1 month') m (month)
  left join public.report_periods pe on pe.org_id = p_org and pe.month = m.month::date
  order by m.month desc;
end $$;

-- Excuses a department from reporting for a month, for example when it spent nothing.
create function public.waive_report(p_org uuid, p_department uuid, p_month date, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; pe public.report_periods; v_me uuid; v_name text;
begin
  perform app.require_perm(p_org, 'periods.close');
  v_me := app.membership_id(p_org);
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  if not exists (select 1 from app.month_departments(p_org, p_month) where department_id = p_department) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  pe := app.ensure_period(p_org, p_month);
  if pe.status = 'closed' then raise exception 'period_closed' using errcode = '22023'; end if;
  r := app.ensure_report(p_org, p_department, p_month);
  select * into r from public.reports where id = r.id for update;
  -- A report with expenses in it, or one Finance is checking, is decided, not waived.
  if r.status not in ('draft', 'returned') or exists (select 1 from public.expense_lines where report_id = r.id) then
    raise exception 'cannot_waive' using errcode = '22023';
  end if;
  update public.reports set status = 'waived', decided_by = v_me, decided_at = now(), lock_version = lock_version + 1
    where id = r.id;
  insert into public.report_events (org_id, report_id, actor_id, type, body) values (p_org, r.id, v_me, 'waived', btrim(p_reason));
  select name into v_name from public.departments where id = p_department;
  perform app.write_audit(p_org, 'report.waived', 'report', r.id, null,
    jsonb_build_object('department', v_name, 'month', p_month), btrim(p_reason));
end $$;

create function public.close_period(p_org uuid, p_month date) returns void
language plpgsql security definer set search_path = '' as $$
declare pe public.report_periods; v_me uuid; v_open bigint;
begin
  perform app.require_perm(p_org, 'periods.close');
  v_me := app.membership_id(p_org);
  if p_month is null or p_month >= date_trunc('month', app.today(p_org))::date then
    raise exception 'invalid_month' using errcode = '22023';
  end if;
  pe := app.ensure_period(p_org, p_month);
  select * into pe from public.report_periods where id = pe.id for update;
  if pe.status = 'closed' then raise exception 'period_closed' using errcode = '22023'; end if;
  select count(*) into v_open from app.month_departments(p_org, p_month) d
    where not exists (select 1 from public.reports r where r.period_id = pe.id and r.department_id = d.department_id
      and r.status in ('approved', 'waived'));
  if v_open > 0 then raise exception 'reports_outstanding' using errcode = '22023'; end if;
  update public.report_periods set status = 'closed', closed_by = v_me, closed_at = now() where id = pe.id;
  update public.expense_lines e set status = 'locked', lock_version = e.lock_version + 1
    from public.reports r where r.period_id = pe.id and e.report_id = r.id and e.status <> 'locked';
  insert into public.period_events (org_id, period_id, actor_id, type) values (p_org, pe.id, v_me, 'closed');
  perform app.notify_about(p_org, array(select h from public.reports r
      cross join lateral app.department_holders(p_org, 'reports.submit', r.department_id) h where r.period_id = pe.id),
    'period_closed', null, null, jsonb_build_object('title', to_char(p_month, 'FMMonth YYYY'), 'actor', app.member_name(v_me)));
  perform app.write_audit(p_org, 'period.closed', 'report_period', pe.id, null, jsonb_build_object('month', p_month));
end $$;

create function public.reopen_period(p_org uuid, p_month date, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare pe public.report_periods; v_me uuid;
begin
  perform app.require_perm(p_org, 'periods.close');
  v_me := app.membership_id(p_org);
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into pe from public.report_periods where org_id = p_org and month = p_month for update;
  if pe.id is null or pe.status <> 'closed' then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- Approved reports stay approved and their lines stay locked; reopening lets waived months be corrected.
  update public.report_periods set status = 'open', closed_by = null, closed_at = null where id = pe.id;
  insert into public.period_events (org_id, period_id, actor_id, type, body) values (p_org, pe.id, v_me, 'reopened', btrim(p_reason));
  perform app.write_audit(p_org, 'period.reopened', 'report_period', pe.id, null, jsonb_build_object('month', p_month), btrim(p_reason));
end $$;

-- Adjustments to an approved report: proposed by one reviewer, decided by another.
create function public.propose_adjustment(p_report uuid, p_amount bigint, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.reports; v_me uuid; v_id uuid;
begin
  select * into r from public.reports where id = p_report for update;
  if r.id is null or not app.can_view_report(r) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(r.org_id, 'reports.review');
  v_me := app.membership_id(r.org_id);
  if r.status <> 'approved' then raise exception 'report_not_approved' using errcode = '22023'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'invalid_amounts' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  insert into public.report_adjustments (org_id, report_id, amount_minor, reason, proposed_by)
    values (r.org_id, p_report, p_amount, btrim(p_reason), v_me) returning id into v_id;
  update public.reports set lock_version = lock_version + 1 where id = p_report;
  insert into public.report_events (org_id, report_id, actor_id, type, body)
    values (r.org_id, p_report, v_me, 'adjustment_proposed', app.format_minor(r.org_id, p_amount) || ': ' || btrim(p_reason));
  perform app.notify_about(r.org_id, array(select h from app.department_holders(r.org_id, 'reports.review', r.department_id) h
    where h <> v_me), 'adjustment_proposed', null, p_report, app.report_payload(r));
  perform app.write_audit(r.org_id, 'report.adjustment_proposed', 'report', p_report, null,
    jsonb_build_object('amount_minor', p_amount), btrim(p_reason));
  return v_id;
end $$;

create function public.decide_adjustment(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.report_adjustments; r public.reports; v_me uuid; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into a from public.report_adjustments where id = p_id for update;
  select * into r from public.reports where id = a.report_id for update;
  if a.id is null or not app.can_view_report(r) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(r.org_id, 'reports.review');
  v_me := app.membership_id(r.org_id);
  if a.proposed_by = v_me then raise exception 'own_adjustment' using errcode = '42501'; end if;
  if a.status <> 'proposed' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not p_approve and char_length(coalesce(v_note, '')) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  update public.report_adjustments set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = v_me, decided_at = now(), decision_note = v_note where id = p_id;
  update public.reports set lock_version = lock_version + 1 where id = r.id;
  insert into public.report_events (org_id, report_id, actor_id, type, body) values (r.org_id, r.id, v_me,
    case when p_approve then 'adjustment_approved' else 'adjustment_rejected' end,
    app.format_minor(r.org_id, a.amount_minor) || coalesce(': ' || v_note, ''));
  perform app.notify_about(r.org_id, array[a.proposed_by], case when p_approve then 'adjustment_approved' else 'adjustment_rejected' end,
    null, r.id, app.report_payload(r));
  perform app.write_audit(r.org_id, 'report.adjustment_' || case when p_approve then 'approved' else 'rejected' end, 'report', r.id,
    null, jsonb_build_object('amount_minor', a.amount_minor), v_note);
end $$;

-- The report page adds its adjustments and whether its month is closed.
alter function public.get_report(uuid) set schema app;
alter function app.get_report(uuid) rename to report_with_review;
create function public.get_report(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.reports; v_me uuid;
begin
  select * into r from public.reports where id = p_id;
  if r.id is null or not app.can_view_report(r) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(r.org_id);
  return app.report_with_review(p_id) || jsonb_build_object(
    'adjustments', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'amount_minor', a.amount_minor, 'reason', a.reason,
      'status', a.status, 'proposed_by', app.member_name(a.proposed_by), 'proposed_at', a.proposed_at,
      'decided_by', case when a.decided_by is not null then app.member_name(a.decided_by) end, 'decided_at', a.decided_at,
      'decision_note', a.decision_note,
      'can_decide', a.status = 'proposed' and a.proposed_by <> v_me and app.has_perm(r.org_id, 'reports.review'))
      order by a.proposed_at), '[]'::jsonb) from public.report_adjustments a where a.report_id = p_id),
    'adjusted_minor', (select coalesce(sum(a.amount_minor), 0) from public.report_adjustments a
      where a.report_id = p_id and a.status = 'approved'),
    'can_adjust', r.status = 'approved' and v_me is not null and app.has_perm(r.org_id, 'reports.review'),
    'period_closed', (select pe.status = 'closed' from public.report_periods pe where pe.id = r.period_id));
end $$;

revoke execute on all functions in schema app from public, anon;
revoke execute on function app.report_with_review(uuid) from authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'month_checklist(uuid, date)', 'list_periods(uuid)', 'waive_report(uuid, uuid, date, text)', 'close_period(uuid, date)',
    'reopen_period(uuid, date, text)', 'propose_adjustment(uuid, bigint, text)', 'decide_adjustment(uuid, boolean, text)',
    'get_report(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
