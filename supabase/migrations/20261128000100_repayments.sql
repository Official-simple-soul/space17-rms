-- Paying people back for expenses they paid with their own money.
-- A payment now belongs to a request or to an expense line. Finance records repayments against accepted personal
-- expenses; the person paid confirms. Nobody pays themselves back, and never more than the expense.

alter table public.payments alter column request_id drop not null,
  add column expense_line_id uuid,
  add constraint payments_expense_line_fkey foreign key (org_id, expense_line_id) references public.expense_lines (org_id, id),
  add constraint payments_subject_check check (num_nonnulls(request_id, expense_line_id) = 1);
create index payments_expense_line_idx on public.payments (expense_line_id);

alter table public.expense_events drop constraint expense_events_type_check;
alter table public.expense_events add constraint expense_events_type_check check (type in ('submitted', 'accepted',
  'returned', 'rejected', 'withdrawn', 'removed', 'evidence_added', 'repaid', 'repayment_voided', 'repayment_confirmed'));

create or replace function app.queue_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('approval_needed', 'request_approved', 'request_returned', 'request_rejected', 'payment_recorded',
    'payment_voided', 'bank_details_changed', 'join_request', 'expense_returned', 'expense_rejected', 'report_submitted',
    'report_due_soon', 'report_due_today', 'report_late', 'request_question', 'report_approved', 'report_returned',
    'line_question', 'item_handed_over', 'repayment_recorded') then
    insert into public.email_outbox (notification_id) values (new.id);
  end if;
  return new;
end $$;

create function app.repaid_minor(p_line uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount_minor), 0)::bigint from public.payments where expense_line_id = p_line and status = 'recorded'
$$;

-- Accepted into a report, paid with someone's own money, and not yet repaid in full.
create function app.owes_repayment(p public.expense_lines) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.funding = 'personal' and p.status in ('accepted', 'locked') and app.repaid_minor(p.id) < p.total_minor
$$;

create function public.record_repayment(
  p_line uuid, p_lock integer, p_amount bigint, p_paid_on date, p_method text, p_reference text, p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.expense_lines; v_me uuid; v_id uuid; v_today date; v_number text; v_payee text;
begin
  select * into e from public.expense_lines where id = p_line for update;
  if e.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(e.org_id, 'payments.record');
  v_me := app.membership_id(e.org_id);
  if v_me in (e.paid_by_membership_id, e.entered_by) then raise exception 'own_payment' using errcode = '42501'; end if;
  if e.lock_version is distinct from p_lock then raise exception 'stale_expense' using errcode = '22023'; end if;
  if not app.owes_repayment(e) then raise exception 'not_payable' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > e.total_minor - app.repaid_minor(p_line) then
    raise exception 'overpayment' using errcode = '22023';
  end if;
  select (now() at time zone timezone)::date into v_today from public.organisations where id = e.org_id;
  if p_paid_on is null or p_paid_on > v_today or p_paid_on < v_today - 366 then
    raise exception 'invalid_paid_on' using errcode = '22023';
  end if;
  v_payee := app.member_name(e.paid_by_membership_id);
  v_number := app.next_number(e.org_id, 'payment');
  insert into public.payments (org_id, number, expense_line_id, payee_membership_id, payee_name, amount_minor, paid_on, method,
    reference, note, recorded_by)
  values (e.org_id, v_number, p_line, e.paid_by_membership_id, v_payee, p_amount, p_paid_on, p_method,
    nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), v_me) returning id into v_id;
  -- The line itself never changes once in a report; only its version moves so open pages refresh.
  update public.expense_lines set lock_version = lock_version + 1 where id = p_line;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
    values (e.org_id, p_line, v_me, 'repaid', v_number || ': ' || app.format_minor(e.org_id, p_amount));
  perform app.notify_about(e.org_id, array[e.paid_by_membership_id], 'repayment_recorded', p_line, null,
    app.expense_payload(e) || jsonb_build_object('actor', app.member_name(v_me)));
  perform app.write_audit(e.org_id, 'payment.recorded', 'payment', v_id, null,
    jsonb_build_object('number', v_number, 'expense', e.description, 'amount_minor', p_amount, 'payee', v_payee, 'method', p_method));
  return v_id;
end $$;

create function public.void_repayment(p_id uuid, p_lock integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.expense_lines; pay public.payments; v_me uuid;
begin
  select l.* into e from public.expense_lines l join public.payments p on p.expense_line_id = l.id where p.id = p_id for update of l;
  if e.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(e.org_id, 'payments.void');
  v_me := app.membership_id(e.org_id);
  if v_me in (e.paid_by_membership_id, e.entered_by) then raise exception 'own_payment' using errcode = '42501'; end if;
  if e.lock_version is distinct from p_lock then raise exception 'stale_expense' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  if exists (select 1 from public.payment_confirmations where payment_id = p_id) then
    raise exception 'void_closed' using errcode = '22023';
  end if;
  update public.payments set status = 'voided', voided_by = v_me, voided_at = now(), void_reason = btrim(p_reason)
    where id = p_id and status = 'recorded' returning * into pay;
  if pay.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.expense_lines set lock_version = lock_version + 1 where id = e.id;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
    values (e.org_id, e.id, v_me, 'repayment_voided', pay.number || ': ' || btrim(p_reason));
  perform app.notify_about(e.org_id, array[e.paid_by_membership_id, pay.recorded_by], 'repayment_voided', e.id, null,
    app.expense_payload(e) || jsonb_build_object('actor', app.member_name(v_me)));
  perform app.write_audit(e.org_id, 'payment.voided', 'payment', p_id, jsonb_build_object('status', 'recorded'),
    jsonb_build_object('number', pay.number, 'amount_minor', pay.amount_minor), btrim(p_reason));
end $$;

create function public.confirm_repayment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.expense_lines; pay public.payments;
begin
  select l.* into e from public.expense_lines l join public.payments p on p.expense_line_id = l.id where p.id = p_id for update of l;
  if e.id is null or e.paid_by_membership_id is distinct from app.membership_id(e.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into pay from public.payments where id = p_id and status = 'recorded';
  if pay.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.payment_confirmations (payment_id, org_id, confirmed_by)
    values (p_id, e.org_id, e.paid_by_membership_id) on conflict do nothing;
  if not found then return; end if;
  update public.expense_lines set lock_version = lock_version + 1 where id = e.id;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
    values (e.org_id, e.id, e.paid_by_membership_id, 'repayment_confirmed', pay.number);
  perform app.notify_about(e.org_id, array[pay.recorded_by], 'repayment_confirmed', e.id, null,
    app.expense_payload(e) || jsonb_build_object('actor', app.member_name(e.paid_by_membership_id)));
  perform app.write_audit(e.org_id, 'payment.confirmed', 'payment', p_id, null, jsonb_build_object('number', pay.number));
end $$;

-- Personal expenses waiting to be repaid, for the Payments page.
create function public.list_repayable(
  p_org uuid, p_search text default '', p_department uuid default null, p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, description text, payee text, department text, total_minor bigint, repaid_minor bigint,
  expense_date date, accepted_at timestamptz, is_own boolean, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org);
begin
  perform app.require_payments(p_org);
  return query
  with due as (
    select e.*, app.member_name(e.paid_by_membership_id) as who, coalesce(d.name, '') as department_name,
      app.repaid_minor(e.id) as repaid
    from public.expense_lines e left join public.departments d on d.id = e.department_id
    where e.org_id = p_org and app.owes_repayment(e) and (p_department is null or e.department_id = p_department)
  )
  select f.id, f.description, f.who, f.department_name, f.total_minor, f.repaid, f.expense_date, f.accepted_at,
    v_me in (f.paid_by_membership_id, f.entered_by), count(*) over ()
  from due f
  where app.matches(concat_ws(' ', f.description, f.who, f.department_name, f.seller_name), p_search)
  order by f.accepted_at, f.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create function app.format_minor(p_org uuid, p_amount bigint) returns text
language sql stable security definer set search_path = '' as $$
  select case coalesce((select currency from public.organisations where id = p_org), 'NGN')
      when 'NGN' then '₦' when 'USD' then '$' when 'GBP' then '£' when 'EUR' then '€'
      else (select currency from public.organisations where id = p_org) || ' ' end
    || to_char(p_amount / 100.0, 'FM999,999,999,999,990.00')
$$;

drop function public.list_payments(uuid, text, text, text, date, date, text, boolean, integer, integer);

create function public.list_payments(
  p_org uuid, p_search text default '', p_status text default null, p_method text default null,
  p_from date default null, p_to date default null, p_sort text default null, p_desc boolean default false,
  p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, number text, request_id uuid, request_number text, title text, expense_id uuid, payee text,
  amount_minor bigint,
  paid_on date, method text, reference text, status text, confirmed boolean, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_payments(p_org);
  return query
  with found as (
    select p.*, r.number as request_no, coalesce(r.title, e.description) as request_title,
      exists (select 1 from public.payment_confirmations c where c.payment_id = p.id) as is_confirmed
    from public.payments p left join public.requests r on r.id = p.request_id
    left join public.expense_lines e on e.id = p.expense_line_id
    where p.org_id = p_org
      and (p_status is null or p.status = p_status)
      and (p_method is null or p.method = p_method)
      and (p_from is null or p.paid_on >= p_from) and (p_to is null or p.paid_on <= p_to)
  )
  select f.id, f.number, f.request_id, f.request_no, f.request_title, f.expense_line_id, f.payee_name, f.amount_minor,
    f.paid_on, f.method,
    f.reference, f.status, f.is_confirmed, count(*) over ()
  from found f
  where app.matches(concat_ws(' ', f.number, f.request_no, f.request_title, f.payee_name, f.reference), p_search)
  order by
    case when p_sort = 'amount' and not p_desc then f.amount_minor end asc,
    case when p_sort = 'amount' and p_desc then f.amount_minor end desc,
    case when p_sort = 'payee' and not p_desc then lower(f.payee_name) end asc,
    case when p_sort = 'payee' and p_desc then lower(f.payee_name) end desc,
    case when p_sort = 'date' and not p_desc then f.paid_on end asc,
    f.paid_on desc, f.created_at desc, f.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.start_payment_proof(p_payment uuid, p_name text, p_mime text, p_size integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pay public.payments; v_id uuid := gen_random_uuid(); v_path text;
begin
  select * into pay from public.payments where id = p_payment and status = 'recorded' for update;
  if pay.id is null or pay.recorded_by is distinct from app.membership_id(pay.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform app.require_perm(pay.org_id, 'payments.record');
  if (select count(*) from public.attachments where payment_id = p_payment and ready_at is not null) >= 5 then
    raise exception 'too_many_proofs' using errcode = '22023';
  end if;
  v_path := pay.org_id || '/payments/' || p_payment || '/' || v_id;
  insert into public.attachments (id, org_id, request_id, expense_line_id, payment_id, kind, storage_path, file_name, mime,
    size, uploaded_by)
    values (v_id, pay.org_id, pay.request_id, pay.expense_line_id, p_payment, 'transfer_proof', v_path, right(btrim(p_name), 160),
      p_mime, p_size, pay.recorded_by);
  return jsonb_build_object('id', v_id, 'path', v_path);
end $$;

alter function public.get_expense(uuid) set schema app;
alter function app.get_expense(uuid) rename to expense_json;

create function public.get_expense(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.expense_lines; v_me uuid; v_json jsonb; v_pay boolean;
begin
  select * into e from public.expense_lines where id = p_id;
  if e.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(e.org_id);
  v_json := app.expense_json(p_id);
  v_pay := app.owes_repayment(e) and app.has_perm(e.org_id, 'payments.record') and v_me is not null
    and v_me not in (e.paid_by_membership_id, e.entered_by);
  return v_json || jsonb_build_object(
    'attachments', (select coalesce(jsonb_agg(x) filter (where x ->> 'payment' is null), '[]'::jsonb)
      from (select jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime, 'size', a.size, 'field_key', a.kind,
        'payment', a.payment_id) as x
        from public.attachments a where a.expense_line_id = p_id and a.ready_at is not null and a.removed_at is null
        order by a.created_at) q),
    'repayment', case when e.funding = 'personal' and e.status in ('accepted', 'locked') then jsonb_build_object(
      'payee', app.member_name(e.paid_by_membership_id),
      'repaid_minor', app.repaid_minor(p_id),
      'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'number', p.number, 'payee', p.payee_name,
        'amount_minor', p.amount_minor, 'paid_on', p.paid_on, 'method', p.method, 'reference', p.reference, 'note', p.note,
        'status', p.status, 'recorded_by', app.member_name(p.recorded_by), 'void_reason', p.void_reason,
        'confirmed_at', (select c.confirmed_at from public.payment_confirmations c where c.payment_id = p.id),
        'can_add_proof', coalesce(p.recorded_by = v_me and p.status = 'recorded', false),
        'proofs', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime, 'size', a.size,
          'field_key', null) order by a.created_at), '[]'::jsonb) from public.attachments a
          where a.payment_id = p.id and a.ready_at is not null and a.removed_at is null)
        ) order by p.created_at), '[]'::jsonb) from public.payments p where p.expense_line_id = p_id),
      'can_pay', v_pay,
      'can_void', app.has_perm(e.org_id, 'payments.void') and v_me is not null and v_me not in (e.paid_by_membership_id, e.entered_by),
      'is_payee', v_me = e.paid_by_membership_id) end);
end $$;

drop function public.my_work(uuid);

create function public.my_work(p_org uuid)
returns table (approvals bigint, unread bigint, open_requests bigint, returned bigint, to_confirm bigint, to_pay bigint,
  join_requests bigint, expenses_waiting bigint, expenses_returned bigint, reports_due bigint, questions bigint,
  reports_to_review bigint, to_hand_over bigint, to_collect bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org);
begin
  if v_me is null then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
      0::bigint, 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;
  return query select
    case when exists (select 1 from app.permission_holders(p_org, 'requests.approve') h where h = v_me) then (
      select count(*) from public.approval_steps st where st.org_id = p_org and st.status = 'active' and app.can_act(st.id, v_me))
    else 0 end,
    (select count(*) from public.notifications n where n.membership_id = v_me and n.read_at is null),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me
      and r.status in ('pending', 'approved', 'part_paid', 'paid', 'received', 'handed_over')),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me and r.status = 'returned'),
    (select count(*) from public.payments p join public.requests r on r.id = p.request_id
      where r.org_id = p_org and r.requester_id = v_me and p.status = 'recorded'
        and not exists (select 1 from public.payment_confirmations c where c.payment_id = p.id))
    + (select count(*) from public.payments p where p.org_id = p_org and p.expense_line_id is not null
      and p.payee_membership_id = v_me and p.status = 'recorded'
      and not exists (select 1 from public.payment_confirmations c where c.payment_id = p.id)),
    case when app.has_perm(p_org, 'payments.record') then (select count(*) from public.requests r
      where r.org_id = p_org and r.status in ('approved', 'part_paid') and r.provision = 'money' and r.requester_id <> v_me)
      + (select count(*) from public.expense_lines e where e.org_id = p_org and app.owes_repayment(e)
        and v_me not in (e.paid_by_membership_id, e.entered_by)) else 0 end,
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
      where r.org_id = p_org and r.status = 'under_review' and r.submitted_by <> v_me) else 0 end,
    (select count(*) from public.requests r where r.org_id = p_org and app.ready_to_hand_over(r) and app.can_hand_over(r)),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me and r.status = 'handed_over');
end $$;

revoke execute on all functions in schema app from public, anon;
revoke execute on function app.expense_json(uuid) from authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'record_repayment(uuid, integer, bigint, date, text, text, text)', 'void_repayment(uuid, integer, text)',
    'confirm_repayment(uuid)', 'list_repayable(uuid, text, uuid, integer, integer)', 'get_expense(uuid)', 'my_work(uuid)',
    'list_payments(uuid, text, text, text, date, date, text, boolean, integer, integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
