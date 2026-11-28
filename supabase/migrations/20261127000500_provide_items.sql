-- Two ways to meet a request: give the requester money, or provide the item.
-- Provided items are never paid through the app. Whoever buys one records it as an expense, linked to the request,
-- so it is accounted for in the monthly report. A provided item goes: approved → handed_over → closed.

alter table public.requests drop constraint requests_provision_check;
update public.requests set provision = 'provide' where provision in ('purchase', 'stock');
-- Nothing is paid for provided items, so "bought" goes back to approved.
update public.requests set status = 'approved' where status in ('bought', 'part_paid', 'paid') and provision = 'provide';
alter table public.requests add constraint requests_provision_check check (provision in ('money', 'provide'));
alter table public.requests drop constraint requests_status_check;
alter table public.requests add constraint requests_status_check check (status in ('draft', 'pending', 'returned',
  'rejected', 'approved', 'part_paid', 'paid', 'received', 'accounted', 'closed', 'cancelled', 'handed_over'));

create or replace function app.ready_to_hand_over(p public.requests) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.provision = 'provide' and p.status = 'approved'
$$;

create or replace function public.save_request(
  p_org uuid, p_id uuid, p_department uuid, p_category uuid, p_title text, p_purpose text,
  p_needed_by date, p_supplier text, p_items jsonb, p_lock integer, p_provision text default null
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
    provision = case when p_provision in ('money', 'provide') then p_provision end,
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
  if v.provision is null then raise exception 'provision_missing' using errcode = '22023'; end if;
  -- A provided item needs no amount; an estimate helps the approver.
  if v.total_minor <= 0 and v.provision = 'money' then raise exception 'amount_missing' using errcode = '22023'; end if;
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
    jsonb_build_object('title', v.title, 'purpose', v.purpose, 'department_id', v.department_id, 'provision', v.provision,
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

create or replace function public.record_payment(
  p_request uuid, p_lock integer, p_amount bigint, p_paid_on date, p_method text,
  p_to_requester boolean, p_payee text, p_reference text, p_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_me uuid; v_id uuid; v_today date; v_number text; v_payee text;
begin
  select * into v from public.requests where id = p_request for update;
  if v.id is null or not app.can_view_request(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(v.org_id, 'payments.record');
  v_me := app.membership_id(v.org_id);
  if v_me = v.requester_id then raise exception 'own_payment' using errcode = '42501'; end if;
  if v.lock_version is distinct from p_lock then raise exception 'stale_request' using errcode = '22023'; end if;
  -- Only money for the requester is paid here; provided items are bought and recorded as expenses.
  if v.status not in ('approved', 'part_paid') or v.provision <> 'money' then
    raise exception 'not_payable' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > v.approved_minor - app.paid_minor(p_request) then
    raise exception 'overpayment' using errcode = '22023';
  end if;
  select (now() at time zone timezone)::date into v_today from public.organisations where id = v.org_id;
  if p_paid_on is null or p_paid_on > v_today or p_paid_on < v_today - 366 then
    raise exception 'invalid_paid_on' using errcode = '22023';
  end if;
  v_payee := case when p_to_requester then app.member_name(v.requester_id) else btrim(coalesce(p_payee, '')) end;
  v_number := app.next_number(v.org_id, 'payment');
  insert into public.payments (org_id, number, request_id, payee_membership_id, payee_name, amount_minor, paid_on, method,
    reference, note, recorded_by)
  values (v.org_id, v_number, p_request, case when p_to_requester then v.requester_id end, v_payee, p_amount, p_paid_on,
    p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), v_me) returning id into v_id;
  insert into public.request_events (org_id, request_id, actor_id, type, step_name, body, amount_minor)
    values (v.org_id, p_request, v_me, 'paid', v_number, 'To ' || v_payee, p_amount);
  v := app.refresh_payment_status(p_request);
  perform app.notify(v.org_id, array[v.requester_id], 'payment_recorded', p_request, app.request_payload(v));
  perform app.write_audit(v.org_id, 'payment.recorded', 'payment', v_id, null,
    jsonb_build_object('number', v_number, 'request', v.number, 'amount_minor', p_amount, 'payee', v_payee, 'method', p_method));
  return v_id;
end $$;

create or replace function public.list_payable(
  p_org uuid, p_search text default '', p_department uuid default null, p_sort text default null, p_desc boolean default false,
  p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, number text, title text, requester text, department text, approved_minor bigint, paid_minor bigint,
  needed_by date, decided_at timestamptz, is_own boolean, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_payments(p_org);
  return query
  with due as (
    select r.*, app.member_name(r.requester_id) as who, coalesce(d.name, '') as department_name, app.paid_minor(r.id) as paid
    from public.requests r left join public.departments d on d.id = r.department_id
    where r.org_id = p_org and r.status in ('approved', 'part_paid') and r.provision = 'money'
      and (p_department is null or r.department_id = p_department)
  )
  select f.id, f.number, f.title, f.who, f.department_name, f.approved_minor, f.paid, f.needed_by, f.decided_at,
    coalesce(f.requester_id = app.membership_id(p_org), false), count(*) over ()
  from due f
  where app.matches(concat_ws(' ', f.number, f.title, f.who, f.department_name), p_search)
  order by
    case when p_sort = 'balance' and not p_desc then f.approved_minor - f.paid end asc,
    case when p_sort = 'balance' and p_desc then f.approved_minor - f.paid end desc,
    case when p_sort in ('title', 'requester') and not p_desc then lower(case p_sort when 'title' then f.title else f.who end) end asc,
    case when p_sort in ('title', 'requester') and p_desc then lower(case p_sort when 'title' then f.title else f.who end) end desc,
    case when p_sort = 'needed' and not p_desc then f.needed_by end asc nulls last,
    case when p_sort = 'needed' and p_desc then f.needed_by end desc nulls last,
    case when p_sort = 'approved' and p_desc then f.decided_at end desc,
    f.decided_at, f.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.my_work(p_org uuid)
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
        and not exists (select 1 from public.payment_confirmations c where c.payment_id = p.id)),
    case when app.has_perm(p_org, 'payments.record') then (select count(*) from public.requests r
      where r.org_id = p_org and r.status in ('approved', 'part_paid') and r.provision = 'money' and r.requester_id <> v_me) else 0 end,
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

create or replace function app.request_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.requests; v_me uuid; v_pay boolean;
begin
  v := app.get_visible_request(p_id);
  v_me := app.membership_id(v.org_id);
  v_pay := app.has_perm(v.org_id, 'payments.record') and v_me is distinct from v.requester_id and v.status in ('approved', 'part_paid')
    and v.provision = 'money';
  return app.request_json(p_id) || jsonb_build_object(
    'attachments', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime,
      'size', a.size, 'field_key', a.field_key) order by a.created_at), '[]'::jsonb) from public.attachments a
      where a.request_id = p_id and a.payment_id is null and a.ready_at is not null and a.removed_at is null),
    'paid_minor', app.paid_minor(p_id),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'number', p.number, 'payee', p.payee_name,
      'amount_minor', p.amount_minor, 'paid_on', p.paid_on, 'method', p.method, 'reference', p.reference, 'note', p.note,
      'status', p.status, 'recorded_by', app.member_name(p.recorded_by), 'void_reason', p.void_reason,
      'confirmed_at', (select c.confirmed_at from public.payment_confirmations c where c.payment_id = p.id),
      'can_add_proof', coalesce(p.recorded_by = v_me and p.status = 'recorded', false),
      'proofs', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime, 'size', a.size,
        'field_key', null) order by a.created_at), '[]'::jsonb) from public.attachments a
        where a.payment_id = p.id and a.ready_at is not null and a.removed_at is null)
      ) order by p.created_at), '[]'::jsonb) from public.payments p where p.request_id = p_id),
    'can_pay', v_pay,
    'can_void', app.has_perm(v.org_id, 'payments.void') and v_me is distinct from v.requester_id
      and v.status in ('part_paid', 'paid', 'received'),
    'bank', case when v_pay and v.provision = 'money' then (select jsonb_build_object('bank_name', b.bank_name, 'account_name', b.account_name,
      'last_digits', b.last_digits, 'updated_at', b.updated_at) from public.bank_accounts b where b.membership_id = v.requester_id) end,
    'provision', v.provision,
    'handover', case when v.handed_over_at is not null then jsonb_build_object('by', app.member_name(v.handed_over_by),
      'at', v.handed_over_at, 'note', v.handover_note, 'received_at', v.item_received_at) end,
    'can_hand_over', app.ready_to_hand_over(v) and app.can_hand_over(v),
    'can_confirm_item', v_me = v.requester_id and v.status = 'handed_over',
    'needs_bank', v.provision = 'money' and v_me = v.requester_id and v.status in ('approved', 'part_paid')
      and not exists (select 1 from public.bank_accounts b where b.membership_id = v_me));
end $$;

create or replace function public.void_payment(p_id uuid, p_lock integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests; pay public.payments; v_me uuid;
begin
  select r.* into v from public.requests r join public.payments p on p.request_id = r.id where p.id = p_id for update of r;
  if v.id is null or not app.can_view_request(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(v.org_id, 'payments.void');
  v_me := app.membership_id(v.org_id);
  if v_me = v.requester_id then raise exception 'own_payment' using errcode = '42501'; end if;
  if v.lock_version is distinct from p_lock then raise exception 'stale_request' using errcode = '22023'; end if;
  if v.status not in ('part_paid', 'paid', 'received') then raise exception 'void_closed' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  update public.payments set status = 'voided', voided_by = v_me, voided_at = now(), void_reason = btrim(p_reason)
    where id = p_id and status = 'recorded' returning * into pay;
  if pay.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.request_events (org_id, request_id, actor_id, type, step_name, body, amount_minor)
    values (v.org_id, v.id, v_me, 'payment_voided', pay.number, btrim(p_reason), pay.amount_minor);
  v := app.refresh_payment_status(v.id);
  perform app.notify(v.org_id, array[v.requester_id, pay.recorded_by], 'payment_voided', v.id, app.request_payload(v));
  perform app.write_audit(v.org_id, 'payment.voided', 'payment', p_id, jsonb_build_object('status', 'recorded'),
    jsonb_build_object('number', pay.number, 'amount_minor', pay.amount_minor), btrim(p_reason));
end $$;

create or replace function app.can_view_request(p public.requests) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p.org_id);
begin
  if v_me = p.requester_id then return true; end if;
  if p.status = 'draft' then return false; end if;
  if app.has_support_access(p.org_id) then return true; end if;
  if v_me is null then return false; end if;
  return app.has_perm(p.org_id, 'requests.view', p.department_id)
    or (p.status in ('approved', 'part_paid', 'paid', 'received', 'accounted', 'closed', 'handed_over')
      and (app.has_perm(p.org_id, 'payments.record') or app.has_perm(p.org_id, 'payments.void')))
    or exists (
      select 1 from public.approval_runs ru join public.approval_steps st on st.run_id = ru.id
      where ru.request_id = p.id and (
        exists (select 1 from public.approval_actions a where a.step_id = st.id and a.membership_id = v_me)
        or (st.status = 'active' and app.can_act(st.id, v_me))));
end $$;

create or replace function public.linkable_requests(p_org uuid)
returns table (id uuid, number text, title text, department_id uuid, category_id uuid)
language sql stable security definer set search_path = '' as $$
  -- Money given to the caller, or an item the caller can provide and is buying for someone.
  select r.id, r.number, r.title, r.department_id, r.category_id from public.requests r
  where r.org_id = p_org and (
      (r.provision = 'money' and r.requester_id = app.membership_id(p_org)
        and r.status in ('approved', 'part_paid', 'paid', 'received'))
      or (r.provision = 'provide' and r.status in ('approved', 'handed_over') and app.can_hand_over(r)))
  order by r.submitted_at desc limit 200
$$;

create or replace function public.claim_emails(p_limit integer default 20)
returns table (id uuid, attempt smallint, email text, name text, type text, payload jsonb, request_id uuid, expense_id uuid,
  report_id uuid, org_name text, org_slug text)
language plpgsql security definer set search_path = '' as $$
begin
  -- Not worth sending: already read, too old, or the person or organisation is no longer active.
  update public.email_outbox o set status = 'skipped'
    from public.notifications n join public.memberships m on m.id = n.membership_id
    join public.organisations g on g.id = n.org_id
    where o.status = 'pending' and n.id = o.notification_id and o.next_attempt_at <= now()
      and (n.read_at is not null or o.created_at < now() - interval '2 days' or m.status <> 'active' or g.status = 'suspended');
  return query
  with picked as materialized (
    select x.id from public.email_outbox x where x.status = 'pending' and x.next_attempt_at <= now()
    order by x.next_attempt_at limit least(greatest(p_limit, 1), 50) for update skip locked
  ), batch as (
    update public.email_outbox o set attempts = o.attempts + 1, next_attempt_at = now() + interval '5 minutes'
      from picked where o.id = picked.id
      returning o.*
  )
  select b.id, b.attempts, u.email::text, app.member_name(m.id), n.type, n.payload, n.request_id, n.expense_line_id, n.report_id,
    g.name, g.slug
  from batch b join public.notifications n on n.id = b.notification_id
  join public.memberships m on m.id = n.membership_id join auth.users u on u.id = m.user_id
  join public.organisations g on g.id = n.org_id;
end $$;

revoke execute on all functions in schema app from public, anon;
