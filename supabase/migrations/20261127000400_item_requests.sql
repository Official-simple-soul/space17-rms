-- Requests for things, not only money.
-- A request is provided as money (as before), bought by the organisation, or given from what it already has.
-- Items are handed over by Finance or someone who may approve the department's requests, and the requester
-- confirms they received it. Bought: approved → part_paid → bought → handed_over → closed.
-- From stock: approved → handed_over → closed. Money keeps its flow.

alter table public.requests
  add column provision text check (provision in ('money', 'purchase', 'stock')),
  add column handed_over_by uuid,
  add column handed_over_at timestamptz,
  add column handover_note text check (char_length(handover_note) <= 500),
  add column item_received_at timestamptz,
  add constraint requests_handed_over_by_fkey foreign key (org_id, handed_over_by) references public.memberships (org_id, id);
-- Everything sent so far was a request for money.
update public.requests set provision = 'money' where status <> 'draft';
alter table public.requests add constraint requests_provision_chosen check (status = 'draft' or provision is not null);
alter table public.requests drop constraint requests_status_check;
alter table public.requests add constraint requests_status_check check (status in ('draft', 'pending', 'returned',
  'rejected', 'approved', 'part_paid', 'paid', 'received', 'accounted', 'closed', 'cancelled', 'bought', 'handed_over'));

alter table public.request_events drop constraint request_events_type_check;
alter table public.request_events add constraint request_events_type_check check (type in ('submitted', 'approved',
  'returned', 'rejected', 'withdrawn', 'reassigned', 'commented', 'paid', 'payment_voided', 'payment_confirmed',
  'handed_over', 'item_received'));

create or replace function app.queue_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('approval_needed', 'request_approved', 'request_returned', 'request_rejected', 'payment_recorded',
    'payment_voided', 'bank_details_changed', 'join_request', 'expense_returned', 'expense_rejected', 'report_submitted',
    'report_due_soon', 'report_due_today', 'report_late', 'request_question', 'report_approved', 'report_returned',
    'line_question', 'item_handed_over') then
    insert into public.email_outbox (notification_id) values (new.id);
  end if;
  return new;
end $$;

-- An item is ready once bought, or straight after approval when it comes from stock.
create function app.ready_to_hand_over(p public.requests) returns boolean
language sql stable security definer set search_path = '' as $$
  select (p.provision = 'purchase' and p.status = 'bought') or (p.provision = 'stock' and p.status = 'approved')
$$;

-- Finance, or anyone who may approve the department's requests (head, deputy, approver, admin); never the requester.
create function app.can_hand_over(p public.requests) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.membership_id(p.org_id) is not null and app.membership_id(p.org_id) is distinct from p.requester_id
    and (app.has_perm(p.org_id, 'payments.record') or app.has_perm(p.org_id, 'requests.approve', p.department_id))
$$;

-- Patched copies of existing functions ----------------------------------------

drop function public.save_request(uuid, uuid, uuid, uuid, text, text, date, text, jsonb, integer);

create function public.save_request(
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
    provision = case when p_provision in ('money', 'purchase', 'stock') then p_provision end,
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
  -- Something already in stock needs no amount.
  if v.total_minor <= 0 and v.provision <> 'stock' then raise exception 'amount_missing' using errcode = '22023'; end if;
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

create or replace function public.decide_request(p_step uuid, p_lock integer, p_action text, p_comment text, p_items jsonb default '[]')
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.requests; st public.approval_steps; ru public.approval_runs; v_me uuid; v_next uuid;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), ''); v_total bigint; v_reduced boolean := false;
begin
  select r.* into v from public.requests r
    join public.approval_runs x on x.request_id = r.id join public.approval_steps s on s.run_id = x.id
    where s.id = p_step for update of r;
  if v.id is null or not app.can_view_request(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(v.org_id);
  if v_me = v.requester_id then raise exception 'own_request' using errcode = '42501'; end if;
  if v.lock_version is distinct from p_lock then raise exception 'stale_request' using errcode = '22023'; end if;
  select * into st from public.approval_steps where id = p_step;
  select * into ru from public.approval_runs where id = st.run_id;
  if v.status <> 'pending' or ru.status <> 'active' or st.status <> 'active' then
    raise exception 'stale_request' using errcode = '22023';
  end if;
  if not app.can_act(p_step, v_me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('approve', 'return', 'reject') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_action <> 'approve' and char_length(coalesce(v_comment, '')) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  if p_action = 'approve' and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    if exists (
      select 1 from jsonb_to_recordset(p_items) as x (id uuid, approved_minor bigint)
      left join public.request_items i on i.id = x.id and i.request_id = v.id
      where i.id is null or x.approved_minor is null or x.approved_minor < 0
        or x.approved_minor > coalesce(i.approved_minor, i.line_total_minor)
    ) or (select count(*) <> count(distinct x.id) from jsonb_to_recordset(p_items) as x (id uuid)) then
      raise exception 'invalid_amounts' using errcode = '22023';
    end if;
    update public.request_items i set approved_minor = x.approved_minor
      from jsonb_to_recordset(p_items) as x (id uuid, approved_minor bigint)
      where i.id = x.id and x.approved_minor < coalesce(i.approved_minor, i.line_total_minor);
    v_reduced := found;
  end if;
  select coalesce(sum(coalesce(approved_minor, line_total_minor)), 0) into v_total
    from public.request_items where request_id = v.id;
  if v_reduced and char_length(coalesce(v_comment, '')) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if v.total_minor > 0 and v_total = 0 then raise exception 'invalid_amounts' using errcode = '22023'; end if;

  insert into public.approval_actions (org_id, step_id, membership_id, action, comment, approved_minor)
    values (v.org_id, p_step, v_me, p_action, v_comment, case when p_action = 'approve' then v_total end);
  insert into public.request_events (org_id, request_id, actor_id, type, step_name, body, amount_minor)
    values (v.org_id, v.id, v_me, case p_action when 'approve' then 'approved' when 'return' then 'returned' else 'rejected' end,
      st.name, v_comment, case when v_reduced then v_total end);
  update public.requests set lock_version = lock_version + 1,
    approved_minor = case when p_action = 'approve' then v_total else approved_minor end
    where id = v.id returning * into v;

  if p_action = 'approve' then
    if (select count(*) from public.approval_actions where step_id = p_step and action = 'approve') >= st.required_approvals then
      update public.approval_steps set status = 'approved', decided_at = now() where id = p_step;
      select id into v_next from public.approval_steps
        where run_id = ru.id and status = 'waiting' order by position limit 1;
      if v_next is not null then
        perform app.activate_step(v_next, v);
      else
        update public.approval_runs set status = 'approved' where id = ru.id;
        -- Money with nothing to pay is done; items still have to be handed over.
        update public.requests set decided_at = now(),
          status = case when total_minor = 0 and provision = 'money' then 'closed' else 'approved' end,
          closed_at = case when total_minor = 0 and provision = 'money' then now() end where id = v.id;
        perform app.notify(v.org_id, array[v.requester_id], 'request_approved', v.id, app.request_payload(v));
      end if;
    end if;
  else
    update public.approval_steps set status = case when id = p_step
        then case p_action when 'return' then 'returned' else 'rejected' end else 'cancelled' end,
      decided_at = case when id = p_step then now() end
      where run_id = ru.id and status in ('active', 'waiting');
    update public.approval_runs set status = case p_action when 'return' then 'returned' else 'rejected' end where id = ru.id;
    update public.requests set status = case p_action when 'return' then 'returned' else 'rejected' end,
      decided_at = now(), closed_at = case when p_action = 'reject' then now() end, approved_minor = null where id = v.id;
    perform app.notify(v.org_id, array[v.requester_id],
      case p_action when 'return' then 'request_returned' else 'request_rejected' end, v.id, app.request_payload(v));
  end if;
  perform app.write_audit(v.org_id, 'request.' || case p_action when 'approve' then 'approved' when 'return' then 'returned' else 'rejected' end,
    'request', v.id, null, jsonb_build_object('number', v.number, 'step', st.name,
      'approved_minor', case when p_action = 'approve' then v_total end), v_comment);
end $$;

create or replace function app.refresh_payment_status(p_request uuid) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_paid bigint := app.paid_minor(p_request); v_status text;
begin
  select * into v from public.requests where id = p_request;
  v_status := case
    when v_paid = 0 then 'approved'
    -- Bought for the requester: once paid in full, it waits to be handed over.
    when v.provision = 'purchase' and v_paid < v.approved_minor then 'part_paid'
    when v.provision = 'purchase' then 'bought'
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
  if v.status not in ('approved', 'part_paid') or v.provision = 'stock' then
    raise exception 'not_payable' using errcode = '22023';
  end if;
  -- Bought for the requester: the seller is paid, not the requester.
  if v.provision = 'purchase' and p_to_requester then raise exception 'pay_seller' using errcode = '22023'; end if;
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
  if v.provision = 'money' then
    perform app.notify(v.org_id, array[v.requester_id], 'payment_recorded', p_request, app.request_payload(v));
  elsif v.status = 'bought' then
    perform app.notify(v.org_id, array[v.requester_id], 'item_bought', p_request, app.request_payload(v));
  end if;
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
    where r.org_id = p_org and r.status in ('approved', 'part_paid') and r.provision <> 'stock'
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

drop function public.list_requests(uuid, text, text, text, uuid, uuid, text, boolean, integer, integer);

create function public.list_requests(
  p_org uuid, p_view text default 'mine', p_search text default '', p_status text default null,
  p_category uuid default null, p_department uuid default null, p_sort text default null, p_desc boolean default false,
  p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, number text, title text, requester text, category text, department text, status text, provision text,
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
      and (p_status is null or r.status = p_status or (p_status = 'to_hand_over' and app.ready_to_hand_over(r)))
      and (p_category is null or r.category_id = p_category)
      and (p_department is null or r.department_id = p_department)
      and case p_view
        when 'mine' then r.requester_id = v_me
        when 'inbox' then r.status = 'pending' and st.id is not null and app.can_act(st.id, v_me)
        when 'all' then r.status <> 'draft' and (v_all or app.can_view_request(r))
        else false end
  )
  select f.id, f.number, f.title, f.who, f.category_name, f.department_name, f.status, coalesce(f.provision, 'money'),
    f.total_minor, f.approved_minor,
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
      and r.status in ('pending', 'approved', 'part_paid', 'paid', 'received', 'bought', 'handed_over')),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me and r.status = 'returned'),
    (select count(*) from public.payments p join public.requests r on r.id = p.request_id
      where r.org_id = p_org and r.requester_id = v_me and p.status = 'recorded'
        and not exists (select 1 from public.payment_confirmations c where c.payment_id = p.id)),
    case when app.has_perm(p_org, 'payments.record') then (select count(*) from public.requests r
      where r.org_id = p_org and r.status in ('approved', 'part_paid') and r.provision <> 'stock' and r.requester_id <> v_me) else 0 end,
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
    and v.provision <> 'stock';
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
      and v.status in ('part_paid', 'paid', 'received', 'bought'),
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

create or replace function app.can_view_request(p public.requests) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p.org_id);
begin
  if v_me = p.requester_id then return true; end if;
  if p.status = 'draft' then return false; end if;
  if app.has_support_access(p.org_id) then return true; end if;
  if v_me is null then return false; end if;
  return app.has_perm(p.org_id, 'requests.view', p.department_id)
    or (p.status in ('approved', 'part_paid', 'paid', 'received', 'accounted', 'closed', 'bought', 'handed_over')
      and (app.has_perm(p.org_id, 'payments.record') or app.has_perm(p.org_id, 'payments.void')))
    or exists (
      select 1 from public.approval_runs ru join public.approval_steps st on st.run_id = ru.id
      where ru.request_id = p.id and (
        exists (select 1 from public.approval_actions a where a.step_id = st.id and a.membership_id = v_me)
        or (st.status = 'active' and app.can_act(st.id, v_me))));
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
  if v.status not in ('part_paid', 'paid', 'received', 'bought') then raise exception 'void_closed' using errcode = '22023'; end if;
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

-- Handing over ---------------------------------------------------------------------

create function public.hand_over_item(p_id uuid, p_lock integer, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_me uuid; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v from public.requests where id = p_id for update;
  if v.id is null or not app.can_view_request(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(v.org_id);
  if not app.can_hand_over(v) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v.lock_version is distinct from p_lock then raise exception 'stale_request' using errcode = '22023'; end if;
  if not app.ready_to_hand_over(v) then raise exception 'not_ready' using errcode = '22023'; end if;
  if char_length(coalesce(v_note, '')) > 500 then raise exception 'note_too_long' using errcode = '22023'; end if;
  update public.requests set status = 'handed_over', handed_over_by = v_me, handed_over_at = now(), handover_note = v_note,
    lock_version = lock_version + 1 where id = p_id returning * into v;
  insert into public.request_events (org_id, request_id, actor_id, type, body) values (v.org_id, p_id, v_me, 'handed_over', v_note);
  perform app.notify(v.org_id, array[v.requester_id], 'item_handed_over', p_id,
    app.request_payload(v) || jsonb_build_object('actor', app.member_name(v_me)));
  perform app.write_audit(v.org_id, 'request.handed_over', 'request', p_id, null, jsonb_build_object('number', v.number), v_note);
end $$;

-- The requester confirms they have it, which completes the request.
create function public.confirm_item(p_id uuid, p_lock integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests;
begin
  v := app.lock_own_request(p_id, p_lock);
  if v.status <> 'handed_over' then raise exception 'request_locked' using errcode = '22023'; end if;
  update public.requests set status = 'closed', item_received_at = now(), closed_at = now(), lock_version = lock_version + 1
    where id = p_id returning * into v;
  insert into public.request_events (org_id, request_id, actor_id, type) values (v.org_id, p_id, v.requester_id, 'item_received');
  perform app.notify(v.org_id, array[v.handed_over_by], 'item_received', p_id,
    app.request_payload(v) || jsonb_build_object('actor', app.member_name(v.requester_id)));
  perform app.write_audit(v.org_id, 'request.item_received', 'request', p_id, null, jsonb_build_object('number', v.number));
end $$;

-- Grants ----------------------------------------------------------------------------

revoke execute on all functions in schema app from public, anon;
revoke execute on function app.request_detail(uuid) from authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'save_request(uuid, uuid, uuid, uuid, text, text, date, text, jsonb, integer, text)',
    'list_requests(uuid, text, text, text, uuid, uuid, text, boolean, integer, integer)', 'my_work(uuid)',
    'hand_over_item(uuid, integer, text)', 'confirm_item(uuid, integer)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
