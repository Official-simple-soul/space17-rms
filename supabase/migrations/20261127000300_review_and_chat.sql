-- Finance reviews monthly reports, and people talk things through.
-- One conversation per request and one per report line. Messages are append-only.
-- A conversation is waiting for an answer ('open'), answered, or, for report lines, resolved by the reviewer.
-- Open or answered line questions block approval until the reviewer resolves them.

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  kind text not null check (kind in ('request', 'line')),
  request_id uuid,
  report_id uuid,
  expense_line_id uuid,
  status text not null default 'answered' check (status in ('open', 'answered', 'resolved')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, request_id) references public.requests (org_id, id),
  foreign key (org_id, report_id) references public.reports (org_id, id),
  foreign key (org_id, expense_line_id) references public.expense_lines (org_id, id),
  foreign key (org_id, resolved_by) references public.memberships (org_id, id),
  check ((kind = 'request') = (request_id is not null and report_id is null and expense_line_id is null)),
  check ((kind = 'line') = (request_id is null and report_id is not null and expense_line_id is not null)),
  check ((status = 'resolved') = (resolved_at is not null))
);
create unique index threads_request_idx on public.threads (request_id) where kind = 'request';
create unique index threads_line_idx on public.threads (expense_line_id) where kind = 'line';
create index threads_report_idx on public.threads (report_id) where kind = 'line';
create trigger touch_updated_at before update on public.threads
  for each row execute function app.touch_updated_at();

create table public.messages (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  thread_id uuid not null,
  author_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  is_question boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (org_id, thread_id) references public.threads (org_id, id),
  foreign key (org_id, author_id) references public.memberships (org_id, id)
);
create index messages_thread_idx on public.messages (thread_id, id);
create trigger messages_append_only before update or delete on public.messages
  for each row execute function app.block_mutation();

alter table public.threads enable row level security;
alter table public.messages enable row level security;
revoke all on public.threads, public.messages from anon, authenticated;

-- Existing request comments become the start of each request's conversation.
insert into public.threads (org_id, kind, request_id, created_at)
select distinct on (e.request_id) e.org_id, 'request', e.request_id, e.created_at
from public.request_events e where e.type = 'commented' order by e.request_id, e.id;
insert into public.messages (org_id, thread_id, author_id, body, created_at)
select e.org_id, t.id, e.actor_id, e.body, e.created_at
from public.request_events e join public.threads t on t.request_id = e.request_id and t.kind = 'request'
where e.type = 'commented' and char_length(btrim(coalesce(e.body, ''))) > 0 order by e.id;

alter table public.report_events drop constraint report_events_type_check;
alter table public.report_events add constraint report_events_type_check
  check (type in ('submitted', 'returned', 'approved'));
alter table public.reports add column decided_by uuid, add column decided_at timestamptz,
  add constraint reports_decided_by_fkey foreign key (org_id, decided_by) references public.memberships (org_id, id);

create or replace function app.queue_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('approval_needed', 'request_approved', 'request_returned', 'request_rejected', 'payment_recorded',
    'payment_voided', 'bank_details_changed', 'join_request', 'expense_returned', 'expense_rejected', 'report_submitted',
    'report_due_soon', 'report_due_today', 'report_late', 'request_question', 'report_approved', 'report_returned',
    'line_question') then
    insert into public.email_outbox (notification_id) values (new.id);
  end if;
  return new;
end $$;

-- People ------------------------------------------------------------------------

-- A short description of someone's part, shown beside their messages.
create function app.member_title(p_org uuid, p_member uuid, p_department uuid) returns text
language sql stable security definer set search_path = '' as $$
  with g as (
    select r.system_key as key, c.department_id from app.current_grants(p_org) c
    join public.roles r on r.id = c.role_id where c.membership_id = p_member
  )
  select case
    when exists (select 1 from g where key = 'hod' and department_id = p_department) then 'Head of department'
    when exists (select 1 from g where key = 'finance') then 'Finance'
    when exists (select 1 from g where key = 'approver' and department_id = p_department) then 'Approver'
    when exists (select 1 from g where key = 'admin') then 'Admin'
  end
$$;

create function app.thread_json(p_thread uuid, p_department uuid, p_first uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'author', app.member_name(m.author_id),
    'title', case when m.author_id = p_first then null else app.member_title(m.org_id, m.author_id, p_department) end,
    'mine', m.author_id = app.membership_id(m.org_id), 'body', m.body, 'question', m.is_question, 'at', m.created_at
  ) order by m.id), '[]'::jsonb)
  from public.messages m where m.thread_id = p_thread
$$;

-- Requests ----------------------------------------------------------------------

create function app.request_thread(p public.requests) returns public.threads
language plpgsql security definer set search_path = '' as $$
declare t public.threads;
begin
  insert into public.threads (org_id, kind, request_id) values (p.org_id, 'request', p.id)
    on conflict (request_id) where kind = 'request' do nothing;
  select * into t from public.threads where request_id = p.id and kind = 'request' for update;
  return t;
end $$;

-- Anyone who can see a submitted request can talk about it. A question, from anyone but the requester,
-- waits for the requester's answer.
create function public.send_request_message(p_id uuid, p_body text, p_question boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_me uuid; t public.threads; v_question boolean := coalesce(p_question, false);
begin
  v := app.get_visible_request(p_id);
  v_me := app.membership_id(v.org_id);
  -- Support access is read-only.
  if v_me is null or v.status = 'draft' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'comment_required' using errcode = '22023';
  end if;
  if v_question and (v_me = v.requester_id or v.status in ('cancelled', 'rejected', 'closed')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  t := app.request_thread(v);
  insert into public.messages (org_id, thread_id, author_id, body, is_question)
    values (v.org_id, t.id, v_me, btrim(p_body), v_question);
  update public.threads set status = case
      when v_question then 'open'
      when v_me = v.requester_id then 'answered'
      else status end
    where id = t.id;
  update public.requests set lock_version = lock_version + 1 where id = p_id;
  perform app.notify(v.org_id, case when v_question then array[v.requester_id] else array(
      select v.requester_id union select m.author_id from public.messages m where m.thread_id = t.id
      union select e.actor_id from public.request_events e where e.request_id = p_id and e.type <> 'commented') end,
    case when v_question then 'request_question' else 'request_comment' end, p_id,
    app.request_payload(v) || jsonb_build_object('actor', app.member_name(v_me)));
end $$;

drop function public.comment_on_request(uuid, text);

-- Reports -----------------------------------------------------------------------

create function app.can_review_report(p public.reports) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.status = 'under_review' and app.membership_id(p.org_id) is not null
    and app.has_perm(p.org_id, 'reports.review', p.department_id)
    and p.submitted_by is distinct from app.membership_id(p.org_id)
$$;

-- People to tell about a report: the department's senders and whoever entered the lines concerned.
create function app.report_people(p public.reports, p_line uuid default null) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select array(
    select app.department_holders(p.org_id, 'reports.submit', p.department_id)
    union select p.submitted_by where p.submitted_by is not null
    union select e.entered_by from public.expense_lines e where e.id = p_line)
$$;

create function app.report_payload(p public.reports) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('number', p.number, 'actor', app.member_name(app.membership_id(p.org_id)),
    'title', d.name || ', ' || to_char(pe.month, 'FMMonth YYYY'))
  from public.departments d, public.report_periods pe where d.id = p.department_id and pe.id = p.period_id
$$;

-- Reviewers ask about a line; the department answers; the reviewer resolves it.
create function public.send_line_message(p_line uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.expense_lines; r public.reports; v_me uuid; t public.threads; v_reviewer boolean;
begin
  select * into e from public.expense_lines where id = p_line;
  select * into r from public.reports where id = e.report_id for update;
  if r.id is null or not app.can_view_report(r) then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- Questions are asked and answered while the report is with the reviewers.
  if r.status <> 'under_review' then raise exception 'report_locked' using errcode = '22023'; end if;
  v_me := app.membership_id(r.org_id);
  v_reviewer := app.can_review_report(r);
  if v_me is null or not (v_reviewer or app.has_perm(r.org_id, 'reports.submit', r.department_id) or e.entered_by = v_me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'comment_required' using errcode = '22023';
  end if;
  select * into t from public.threads where expense_line_id = p_line and kind = 'line' for update;
  if t.id is null then
    -- Only a reviewer starts a question, and only while the report is with them.
    if not v_reviewer then raise exception 'not_allowed' using errcode = '42501'; end if;
    insert into public.threads (org_id, kind, report_id, expense_line_id, status)
      values (r.org_id, 'line', r.id, p_line, 'open') returning * into t;
  end if;
  insert into public.messages (org_id, thread_id, author_id, body, is_question)
    values (r.org_id, t.id, v_me, btrim(p_body), v_reviewer);
  update public.threads set status = case when v_reviewer then 'open' else 'answered' end,
    resolved_by = null, resolved_at = null where id = t.id;
  update public.reports set lock_version = lock_version + 1 where id = r.id;
  perform app.notify_about(r.org_id,
    case when v_reviewer then app.report_people(r, p_line)
      else array(select m.author_id from public.messages m where m.thread_id = t.id) end,
    case when v_reviewer then 'line_question' else 'line_answered' end, null, r.id,
    app.report_payload(r) || jsonb_build_object('line', e.description));
end $$;

create function public.resolve_line_question(p_line uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; t public.threads;
begin
  select r2.* into r from public.reports r2 join public.expense_lines e on e.report_id = r2.id where e.id = p_line for update of r2;
  if r.id is null or not app.can_view_report(r) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not app.can_review_report(r) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.threads set status = 'resolved', resolved_by = app.membership_id(r.org_id), resolved_at = now()
    where expense_line_id = p_line and kind = 'line' and status <> 'resolved' returning * into t;
  if t.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.reports set lock_version = lock_version + 1 where id = r.id;
end $$;

-- Approve or return a report. Open questions block approval; lines without a receipt need a written reason.
create function public.review_report(p_id uuid, p_lock integer, p_action text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; v_me uuid; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_missing bigint;
begin
  select * into r from public.reports where id = p_id for update;
  if r.id is null or not app.can_view_report(r) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(r.org_id);
  perform app.require_perm(r.org_id, 'reports.review');
  if r.submitted_by = v_me then raise exception 'own_report' using errcode = '42501'; end if;
  if not app.can_review_report(r) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if r.lock_version is distinct from p_lock then raise exception 'stale_report' using errcode = '22023'; end if;
  if p_action not in ('approve', 'return') then raise exception 'invalid_action' using errcode = '22023'; end if;
  if p_action = 'return' then
    if char_length(coalesce(v_reason, '')) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
    update public.reports set status = 'returned', decided_by = v_me, decided_at = now(), lock_version = lock_version + 1
      where id = p_id;
  else
    if exists (select 1 from public.threads t where t.report_id = p_id and t.kind = 'line' and t.status <> 'resolved') then
      raise exception 'open_questions' using errcode = '22023';
    end if;
    select count(*) into v_missing from public.expense_lines where report_id = p_id and app.evidence_of(id) = 'missing';
    if v_missing > 0 and char_length(coalesce(v_reason, '')) < 5 then
      raise exception 'missing_evidence_reason' using errcode = '22023';
    end if;
    update public.reports set status = 'approved', decided_by = v_me, decided_at = now(), lock_version = lock_version + 1
      where id = p_id;
    -- Approved lines never change again.
    update public.expense_lines set status = 'locked', lock_version = lock_version + 1 where report_id = p_id;
  end if;
  insert into public.report_events (org_id, report_id, actor_id, type, body)
    values (r.org_id, p_id, v_me, case p_action when 'approve' then 'approved' else 'returned' end, v_reason);
  perform app.notify_about(r.org_id, app.report_people(r), case p_action when 'approve' then 'report_approved' else 'report_returned' end,
    null, p_id, app.report_payload(r) || jsonb_build_object('reason', v_reason));
  perform app.write_audit(r.org_id, 'report.' || case p_action when 'approve' then 'approved' else 'returned' end, 'report', p_id,
    null, jsonb_build_object('number', r.number), v_reason);
end $$;

-- Reading -----------------------------------------------------------------------

-- The report page adds the review state and each line's conversation.
alter function public.get_report(uuid) set schema app;
alter function app.get_report(uuid) rename to report_json;
create function public.get_report(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.reports; v_me uuid; v_json jsonb;
begin
  select * into r from public.reports where id = p_id;
  if r.id is null or not app.can_view_report(r) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(r.org_id);
  v_json := app.report_json(p_id);
  return v_json || jsonb_build_object(
    'lines', (select coalesce(jsonb_agg(l || jsonb_build_object('thread', (
        select jsonb_build_object('status', t.status, 'messages', app.thread_json(t.id, r.department_id, null))
        from public.threads t where t.expense_line_id = (l ->> 'id')::uuid and t.kind = 'line'),
        'can_message', v_me is not null and r.status = 'under_review' and (app.can_review_report(r)
          or app.has_perm(r.org_id, 'reports.submit', r.department_id)
          or exists (select 1 from public.expense_lines e where e.id = (l ->> 'id')::uuid and e.entered_by = v_me)))
      ), '[]'::jsonb) from jsonb_array_elements(v_json -> 'lines') l),
    'can_review', app.can_review_report(r),
    'own_report', r.submitted_by is not null and r.submitted_by = v_me,
    'open_questions', (select count(*) from public.threads t where t.report_id = p_id and t.kind = 'line' and t.status <> 'resolved'),
    'decided_by', case when r.decided_by is not null then app.member_name(r.decided_by) end,
    'decided_at', r.decided_at);
end $$;

-- The request page adds its conversation.
alter function public.get_request(uuid) set schema app;
alter function app.get_request(uuid) rename to request_detail;
create function public.get_request(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.requests; v_me uuid; t public.threads; v_base jsonb;
begin
  v := app.get_visible_request(p_id);
  v_me := app.membership_id(v.org_id);
  select * into t from public.threads where request_id = p_id and kind = 'request';
  v_base := app.request_detail(p_id);
  return v_base || jsonb_build_object(
    'chat', jsonb_build_object(
      'status', coalesce(t.status, 'answered'),
      'messages', case when t.id is null then '[]'::jsonb else app.thread_json(t.id, v.department_id, v.requester_id) end),
    'can_message', v_me is not null and v.status <> 'draft',
    'can_ask', v_me is not null and v_me <> v.requester_id and v.status not in ('draft', 'cancelled', 'rejected', 'closed'));
end $$;

-- Work waiting for someone now includes questions and reports to check.
drop function public.my_work(uuid);
create function public.my_work(p_org uuid)
returns table (approvals bigint, unread bigint, open_requests bigint, returned bigint, to_confirm bigint, to_pay bigint,
  join_requests bigint, expenses_waiting bigint, expenses_returned bigint, reports_due bigint, questions bigint,
  reports_to_review bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org);
begin
  if v_me is null then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
      0::bigint, 0::bigint;
    return;
  end if;
  return query select
    case when exists (select 1 from app.permission_holders(p_org, 'requests.approve') h where h = v_me) then (
      select count(*) from public.approval_steps st where st.org_id = p_org and st.status = 'active' and app.can_act(st.id, v_me))
    else 0 end,
    (select count(*) from public.notifications n where n.membership_id = v_me and n.read_at is null),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me
      and r.status in ('pending', 'approved', 'part_paid', 'paid', 'received')),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me and r.status = 'returned'),
    (select count(*) from public.payments p join public.requests r on r.id = p.request_id
      where r.org_id = p_org and r.requester_id = v_me and p.status = 'recorded'
        and not exists (select 1 from public.payment_confirmations c where c.payment_id = p.id)),
    case when app.has_perm(p_org, 'payments.record') then (select count(*) from public.requests r
      where r.org_id = p_org and r.status in ('approved', 'part_paid') and r.requester_id <> v_me) else 0 end,
    case when app.has_perm(p_org, 'members.manage') then (select count(*) from public.join_requests j
      where j.org_id = p_org and j.status = 'pending' and j.created_at > now() - interval '14 days') else 0 end,
    (select count(*) from public.expense_lines e where e.org_id = p_org and e.status = 'submitted'
      and app.has_perm(p_org, 'expenses.accept', e.department_id)),
    (select count(*) from public.expense_lines e where e.org_id = p_org and e.entered_by = v_me and e.status = 'returned'),
    -- Only months that have ended: the current one is not due yet.
    (select count(*) from public.my_report_months(p_org) m where coalesce(m.status, 'draft') in ('draft', 'returned')
      and m.month < date_trunc('month', app.today(p_org))::date),
    -- Questions waiting for this person: about their requests, or about lines in their department's reports.
    (select count(*) from public.threads t join public.requests r on r.id = t.request_id
      where t.org_id = p_org and t.kind = 'request' and t.status = 'open' and r.requester_id = v_me)
    + (select count(*) from public.threads t join public.reports r on r.id = t.report_id
      where t.org_id = p_org and t.kind = 'line' and t.status = 'open' and r.status = 'under_review'
        and app.has_perm(p_org, 'reports.submit', r.department_id)),
    case when app.has_perm(p_org, 'reports.review') then (select count(*) from public.reports r
      where r.org_id = p_org and r.status = 'under_review' and r.submitted_by <> v_me) else 0 end;
end $$;

-- Grants ------------------------------------------------------------------------

revoke execute on all functions in schema app from public, anon;
revoke execute on function app.report_json(uuid), app.request_detail(uuid) from authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'send_request_message(uuid, text, boolean)', 'send_line_message(uuid, text)', 'resolve_line_question(uuid)',
    'review_report(uuid, integer, text, text)', 'get_report(uuid)', 'get_request(uuid)', 'my_work(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
