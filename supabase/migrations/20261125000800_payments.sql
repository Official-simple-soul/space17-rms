-- Payments, protected bank details, the email outbox and join codes.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  number text not null,
  request_id uuid not null,
  payee_membership_id uuid,
  payee_name text not null check (char_length(btrim(payee_name)) between 2 and 120),
  amount_minor bigint not null check (amount_minor > 0),
  paid_on date not null,
  method text not null check (method in ('bank_transfer', 'cash', 'cheque', 'card', 'other')),
  reference text check (char_length(reference) <= 80),
  note text check (char_length(note) <= 500),
  status text not null default 'recorded' check (status in ('recorded', 'voided')),
  recorded_by uuid not null,
  voided_by uuid,
  voided_at timestamptz,
  void_reason text check (char_length(void_reason) <= 500),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, number),
  foreign key (org_id, request_id) references public.requests (org_id, id),
  foreign key (org_id, payee_membership_id) references public.memberships (org_id, id),
  foreign key (org_id, recorded_by) references public.memberships (org_id, id),
  foreign key (org_id, voided_by) references public.memberships (org_id, id),
  check ((status = 'voided') = (voided_by is not null and voided_at is not null and void_reason is not null))
);
create index payments_request_idx on public.payments (request_id);
create index payments_date_idx on public.payments (org_id, paid_on);

create table public.payment_confirmations (
  payment_id uuid primary key,
  org_id uuid not null,
  confirmed_by uuid not null,
  confirmed_at timestamptz not null default now(),
  foreign key (org_id, payment_id) references public.payments (org_id, id),
  foreign key (org_id, confirmed_by) references public.memberships (org_id, id)
);

alter table public.attachments add column payment_id uuid,
  add foreign key (org_id, payment_id) references public.payments (org_id, id);

alter table public.request_events drop constraint request_events_type_check;
alter table public.request_events add constraint request_events_type_check check (type in ('submitted', 'approved',
  'returned', 'rejected', 'withdrawn', 'reassigned', 'commented', 'paid', 'payment_voided', 'payment_confirmed'));

-- Full account numbers live encrypted in the vault; this table holds only what may be shown.
create table public.bank_accounts (
  membership_id uuid primary key,
  org_id uuid not null,
  bank_name text not null check (char_length(btrim(bank_name)) between 2 and 80),
  account_name text not null check (char_length(btrim(account_name)) between 2 and 120),
  last_digits text not null check (last_digits ~ '^[A-Z0-9]{4}$'),
  secret_id uuid not null,
  updated_at timestamptz not null default now(),
  foreign key (org_id, membership_id) references public.memberships (org_id, id)
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications (id),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now()
);
create index email_outbox_due_idx on public.email_outbox (next_attempt_at) where status = 'pending';

create table public.join_codes (
  org_id uuid primary key references public.organisations (id),
  code text not null unique check (code ~ '^[A-Z2-9]{10}$'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key (org_id, created_by) references public.memberships (org_id, id)
);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  status text not null default 'unverified' check (status in ('unverified', 'pending', 'approved', 'rejected')),
  token_hash text not null unique,
  token_expires_at timestamptz not null,
  verified_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, decided_by) references public.memberships (org_id, id)
);
create unique index join_requests_one_open on public.join_requests (org_id, email) where status in ('unverified', 'pending');

do $$
declare t text;
begin
  foreach t in array array['payments', 'payment_confirmations', 'bank_accounts', 'email_outbox', 'join_codes', 'join_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Request visibility: people who pay need to see what is payable.
create or replace function app.can_view_request(p public.requests) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p.org_id);
begin
  if v_me = p.requester_id then return true; end if;
  if p.status = 'draft' then return false; end if;
  if app.has_support_access(p.org_id) then return true; end if;
  if v_me is null then return false; end if;
  return app.has_perm(p.org_id, 'requests.view', p.department_id)
    or app.has_category_perm(p.org_id, 'requests.view', p.category_id, p.department_id)
    or (p.status in ('approved', 'part_paid', 'paid', 'received', 'accounted', 'closed')
      and (app.has_perm(p.org_id, 'payments.record') or app.has_perm(p.org_id, 'payments.void')))
    or exists (
      select 1 from public.approval_runs ru join public.approval_steps st on st.run_id = ru.id
      where ru.request_id = p.id and (
        exists (select 1 from public.approval_actions a where a.step_id = st.id and a.membership_id = v_me)
        or (st.status = 'active' and app.can_act(st.id, v_me))));
end $$;

-- Payments --------------------------------------------------------------------

create function app.paid_minor(p_request uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount_minor), 0)::bigint from public.payments where request_id = p_request and status = 'recorded'
$$;

create function app.refresh_payment_status(p_request uuid) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_paid bigint := app.paid_minor(p_request); v_status text;
begin
  select * into v from public.requests where id = p_request;
  v_status := case
    when v_paid = 0 then 'approved'
    when v_paid < v.approved_minor then 'part_paid'
    when exists (select 1 from public.payments p where p.request_id = p_request and p.status = 'recorded'
      and not exists (select 1 from public.payment_confirmations c where c.payment_id = p.id)) then 'paid'
    when (select requires_accounting from public.categories where id = v.category_id) then 'received'
    else 'closed' end;
  update public.requests set status = v_status, lock_version = lock_version + 1,
    closed_at = case when v_status = 'closed' then now() end
    where id = p_request returning * into v;
  return v;
end $$;

create function public.record_payment(
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
  if v.status not in ('approved', 'part_paid') then raise exception 'not_payable' using errcode = '22023'; end if;
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

create function public.void_payment(p_id uuid, p_lock integer, p_reason text) returns void
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

create function public.confirm_payment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests; pay public.payments;
begin
  select r.* into v from public.requests r join public.payments p on p.request_id = r.id where p.id = p_id for update of r;
  if v.id is null or v.requester_id is distinct from app.membership_id(v.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into pay from public.payments where id = p_id and status = 'recorded';
  if pay.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.payment_confirmations (payment_id, org_id, confirmed_by)
    values (p_id, v.org_id, v.requester_id) on conflict do nothing;
  if not found then return; end if;
  insert into public.request_events (org_id, request_id, actor_id, type, step_name, amount_minor)
    values (v.org_id, v.id, v.requester_id, 'payment_confirmed', pay.number, pay.amount_minor);
  v := app.refresh_payment_status(v.id);
  perform app.notify(v.org_id, array[pay.recorded_by], 'payment_confirmed', v.id, app.request_payload(v));
  perform app.write_audit(v.org_id, 'payment.confirmed', 'payment', p_id, null, jsonb_build_object('number', pay.number));
end $$;

-- Proof of payment ------------------------------------------------------------

create function public.start_payment_proof(p_payment uuid, p_name text, p_mime text, p_size integer) returns jsonb
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
  insert into public.attachments (id, org_id, request_id, payment_id, kind, storage_path, file_name, mime, size, uploaded_by)
    values (v_id, pay.org_id, pay.request_id, p_payment, 'transfer_proof', v_path, right(btrim(p_name), 160), p_mime, p_size, pay.recorded_by);
  return jsonb_build_object('id', v_id, 'path', v_path);
end $$;

create or replace function public.get_pending_attachment(p_id uuid) returns table (storage_path text, mime text)
language sql stable security definer set search_path = '' as $$
  select a.storage_path, a.mime from public.attachments a
  where a.id = p_id and a.ready_at is null and a.uploaded_by = app.membership_id(a.org_id)
$$;

create or replace function public.finish_attachment(p_id uuid, p_size integer, p_sha256 text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.attachments a set ready_at = now(), size = p_size, sha256 = p_sha256
    from public.requests r
    where a.id = p_id and r.id = a.request_id and a.ready_at is null
      and case when a.payment_id is null then r.status in ('draft', 'returned')
        else exists (select 1 from public.payments p where p.id = a.payment_id and p.status = 'recorded') end;
  if not found then raise exception 'request_locked' using errcode = '22023'; end if;
end $$;

-- Bank details ----------------------------------------------------------------

create function public.save_bank_account(p_org uuid, p_bank text, p_name text, p_number text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.membership_id(p_org); v_number text := upper(regexp_replace(coalesce(p_number, ''), '[\s-]', '', 'g'));
  v_secret uuid; v_currency text;
begin
  if v_me is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select currency into v_currency from public.organisations where id = p_org;
  if (v_currency = 'NGN' and v_number !~ '^\d{10}$') or v_number !~ '^[A-Z0-9]{6,34}$' then
    raise exception 'invalid_account' using errcode = '22023';
  end if;
  -- One change at a time per person.
  perform 1 from public.memberships where id = v_me for update;
  select secret_id into v_secret from public.bank_accounts where membership_id = v_me;
  if v_secret is null then
    v_secret := vault.create_secret(v_number, 'bank:' || v_me, 'Bank account number');
  else
    perform vault.update_secret(v_secret, v_number);
  end if;
  insert into public.bank_accounts (membership_id, org_id, bank_name, account_name, last_digits, secret_id)
    values (v_me, p_org, btrim(p_bank), btrim(p_name), right(v_number, 4), v_secret)
  on conflict (membership_id) do update set bank_name = excluded.bank_name, account_name = excluded.account_name,
    last_digits = excluded.last_digits, updated_at = now();
  -- Sent to the owner, so a change they did not make is noticed.
  insert into public.notifications (org_id, membership_id, type) values (p_org, v_me, 'bank_details_changed');
  perform app.write_audit(p_org, 'bank_details.changed', 'bank_account', v_me, null, jsonb_build_object('last_digits', right(v_number, 4)));
end $$;

create function public.remove_bank_account(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org); v_secret uuid;
begin
  delete from public.bank_accounts where membership_id = v_me returning secret_id into v_secret;
  if v_secret is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  delete from vault.secrets where id = v_secret;
  insert into public.notifications (org_id, membership_id, type) values (p_org, v_me, 'bank_details_changed');
  perform app.write_audit(p_org, 'bank_details.removed', 'bank_account', v_me);
end $$;

create function public.my_bank_account(p_org uuid)
returns table (bank_name text, account_name text, last_digits text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.bank_name, b.account_name, b.last_digits, b.updated_at
  from public.bank_accounts b where b.org_id = p_org and b.membership_id = app.membership_id(p_org)
$$;

-- Only while there is something to pay, only to someone who may pay it, and always recorded.
create function public.reveal_bank_account(p_request uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_number text; b public.bank_accounts;
begin
  select * into v from public.requests where id = p_request;
  if v.id is null or not app.can_view_request(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(v.org_id, 'payments.record');
  if v.requester_id = app.membership_id(v.org_id) then raise exception 'own_payment' using errcode = '42501'; end if;
  if v.status not in ('approved', 'part_paid') then raise exception 'not_payable' using errcode = '22023'; end if;
  select * into b from public.bank_accounts where membership_id = v.requester_id;
  select decrypted_secret into v_number from vault.decrypted_secrets where id = b.secret_id;
  if v_number is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(v.org_id, 'bank_details.revealed', 'bank_account', v.requester_id, null,
    jsonb_build_object('request', v.number, 'owner', app.member_name(v.requester_id), 'last_digits', b.last_digits));
  return v_number;
end $$;

-- Reading -----------------------------------------------------------------------

alter function public.get_request(uuid) set schema app;
alter function app.get_request(uuid) rename to request_json;
revoke execute on function app.request_json(uuid) from public, anon, authenticated;

create function public.get_request(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.requests; v_me uuid; v_pay boolean;
begin
  v := app.get_visible_request(p_id);
  v_me := app.membership_id(v.org_id);
  v_pay := app.has_perm(v.org_id, 'payments.record') and v_me is distinct from v.requester_id and v.status in ('approved', 'part_paid');
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
    'bank', case when v_pay then (select jsonb_build_object('bank_name', b.bank_name, 'account_name', b.account_name,
      'last_digits', b.last_digits, 'updated_at', b.updated_at) from public.bank_accounts b where b.membership_id = v.requester_id) end,
    'needs_bank', v_me = v.requester_id and v.status in ('approved', 'part_paid')
      and not exists (select 1 from public.bank_accounts b where b.membership_id = v_me));
end $$;

create function app.require_payments(p_org uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_perm(p_org, 'payments.record') or app.has_perm(p_org, 'payments.void') or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end $$;

create function public.list_payable(
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
    where r.org_id = p_org and r.status in ('approved', 'part_paid') and (p_department is null or r.department_id = p_department)
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

create function public.list_payments(
  p_org uuid, p_search text default '', p_status text default null, p_method text default null,
  p_from date default null, p_to date default null, p_sort text default null, p_desc boolean default false,
  p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, number text, request_id uuid, request_number text, title text, payee text, amount_minor bigint,
  paid_on date, method text, reference text, status text, confirmed boolean, total bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_payments(p_org);
  return query
  with found as (
    select p.*, r.number as request_no, r.title as request_title,
      exists (select 1 from public.payment_confirmations c where c.payment_id = p.id) as is_confirmed
    from public.payments p join public.requests r on r.id = p.request_id
    where p.org_id = p_org
      and (p_status is null or p.status = p_status)
      and (p_method is null or p.method = p_method)
      and (p_from is null or p.paid_on >= p_from) and (p_to is null or p.paid_on <= p_to)
  )
  select f.id, f.number, f.request_id, f.request_no, f.request_title, f.payee_name, f.amount_minor, f.paid_on, f.method,
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

drop function public.my_work(uuid);
create function public.my_work(p_org uuid)
returns table (approvals bigint, unread bigint, open_requests bigint, returned bigint, to_confirm bigint, to_pay bigint, join_requests bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org);
begin
  if v_me is null then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
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
      where j.org_id = p_org and j.status = 'pending' and j.created_at > now() - interval '14 days') else 0 end;
end $$;

-- Email -------------------------------------------------------------------------

create function app.queue_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('approval_needed', 'request_approved', 'request_returned', 'request_rejected', 'payment_recorded',
    'payment_voided', 'bank_details_changed', 'join_request') then
    insert into public.email_outbox (notification_id) values (new.id);
  end if;
  return new;
end $$;
create trigger queue_email after insert on public.notifications for each row execute function app.queue_email();

-- Takes a batch for five minutes. A crashed worker's batch becomes available again.
create function public.claim_emails(p_limit integer default 20)
returns table (id uuid, attempt smallint, email text, name text, type text, payload jsonb, request_id uuid, org_name text, org_slug text)
language plpgsql security definer set search_path = '' as $$
begin
  -- Not worth sending: already read, too old, or the person or organisation is no longer active.
  update public.email_outbox o set status = 'skipped'
    from public.notifications n join public.memberships m on m.id = n.membership_id
    join public.organisations g on g.id = n.org_id
    where o.status = 'pending' and n.id = o.notification_id and o.next_attempt_at <= now()
      and (n.read_at is not null or o.created_at < now() - interval '2 days' or m.status <> 'active' or g.status = 'suspended');
  return query
  with batch as (
    update public.email_outbox o set attempts = o.attempts + 1, next_attempt_at = now() + interval '5 minutes'
      where o.id in (select x.id from public.email_outbox x where x.status = 'pending' and x.next_attempt_at <= now()
        order by x.next_attempt_at limit least(greatest(p_limit, 1), 50) for update skip locked)
      returning o.*
  )
  select b.id, b.attempts, u.email::text, app.member_name(m.id), n.type, n.payload, n.request_id, g.name, g.slug
  from batch b join public.notifications n on n.id = b.notification_id
  join public.memberships m on m.id = n.membership_id join auth.users u on u.id = m.user_id
  join public.organisations g on g.id = n.org_id;
end $$;

-- p_attempt is the claim being reported, so a slow worker cannot overwrite a later one.
create function public.finish_email(p_id uuid, p_attempt smallint, p_ok boolean, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update public.email_outbox set
    status = case when p_ok then 'sent' when attempts >= 6 then 'failed' else 'pending' end,
    sent_at = case when p_ok then now() end,
    last_error = left(p_error, 300),
    next_attempt_at = now() + (array[1, 5, 15, 60, 240, 240])[least(attempts, 6)] * interval '1 minute'
  where id = p_id and status = 'pending' and attempts = p_attempt
$$;

-- Join codes ----------------------------------------------------------------------

create function public.get_join_code(p_org uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'members.manage', false);
  return (select code from public.join_codes where org_id = p_org);
end $$;

create function public.set_join_code(p_org uuid, p_enabled boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text; v_bytes bytea := extensions.gen_random_bytes(10);
begin
  perform app.require_perm(p_org, 'members.manage');
  if not p_enabled then
    delete from public.join_codes where org_id = p_org;
    perform app.write_audit(p_org, 'join_code.disabled', 'join_code', p_org);
    return null;
  end if;
  -- No easily confused characters; 32 symbols, so every byte maps evenly.
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(v_bytes, i) % 32 + 1, 1), '') into v_code
    from generate_series(0, 9) i;
  insert into public.join_codes (org_id, code, created_by) values (p_org, v_code, app.membership_id(p_org))
    on conflict (org_id) do update set code = excluded.code, created_by = excluded.created_by, created_at = now();
  perform app.write_audit(p_org, 'join_code.changed', 'join_code', p_org);
  return v_code;
end $$;

-- Server only. No row means nothing should be emailed; the visitor is told the same either way.
create function public.submit_join_request(p_code text, p_name text, p_email text)
returns table (token text, org_name text)
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_email text := lower(btrim(p_email)); v_token text := encode(extensions.gen_random_bytes(32), 'hex'); v_id uuid;
begin
  if (select count(*) from public.join_requests where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  select c.org_id into v_org from public.join_codes c join public.organisations o on o.id = c.org_id and o.status <> 'suspended'
    where c.code = upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  if v_org is null then raise exception 'join_code_invalid' using errcode = '22023'; end if;
  perform app.lock_org(v_org);
  if (select count(*) from public.join_requests where org_id = v_org and created_at > now() - interval '1 hour') >= 50 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  -- Out of date requests make way for a new one.
  delete from public.join_requests where org_id = v_org and email = v_email and (
    (status = 'unverified' and created_at < now() - interval '2 minutes')
    or (status = 'pending' and created_at < now() - interval '14 days'));
  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
      where m.org_id = v_org and lower(u.email) = v_email and m.status <> 'left')
    or exists (select 1 from public.join_requests where org_id = v_org and email = v_email
      and (status in ('unverified', 'pending') or (status = 'rejected' and decided_at > now() - interval '7 days'))) then
    return;
  end if;
  insert into public.join_requests (org_id, email, full_name, token_hash, token_expires_at)
    values (v_org, v_email, btrim(p_name), app.hash_token(v_token), now() + interval '24 hours') returning id into v_id;
  return query select v_token, o.name from public.organisations o where o.id = v_org;
end $$;

create function public.verify_join_request(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare j public.join_requests; v_name text;
begin
  select * into j from public.join_requests where token_hash = app.hash_token(p_token) for update;
  select name into v_name from public.organisations where id = j.org_id and status <> 'suspended';
  if j.id is null or v_name is null or j.status not in ('unverified', 'pending') or j.token_expires_at <= now() then
    raise exception 'invite_invalid' using errcode = '22023';
  end if;
  if j.status = 'unverified' then
    update public.join_requests set status = 'pending', verified_at = now() where id = j.id;
    perform app.notify(j.org_id, array(select app.permission_holders(j.org_id, 'members.manage')), 'join_request', null,
      jsonb_build_object('requester', j.full_name));
    perform app.write_audit(j.org_id, 'join_request.received', 'join_request', j.id, null, jsonb_build_object('email', j.email));
  end if;
  return v_name;
end $$;

create function public.list_join_requests(p_org uuid)
returns table (id uuid, email text, full_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'members.manage', false);
  return query select j.id, j.email, j.full_name, j.created_at from public.join_requests j
    where j.org_id = p_org and j.status = 'pending' and j.created_at > now() - interval '14 days' order by j.created_at;
end $$;

create function public.approve_join_request(p_org uuid, p_id uuid, p_role uuid, p_department uuid default null)
returns table (token text, email text)
language plpgsql security definer set search_path = '' as $$
declare v_email text; v_token text;
begin
  perform app.require_perm(p_org, 'members.manage');
  update public.join_requests j set status = 'approved', decided_by = app.membership_id(p_org), decided_at = now()
    where j.org_id = p_org and j.id = p_id and j.status = 'pending' and j.created_at > now() - interval '14 days'
    returning j.email into v_email;
  if v_email is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_token := public.invite_member(p_org, v_email, p_role, p_department);
  perform app.write_audit(p_org, 'join_request.approved', 'join_request', p_id, null, jsonb_build_object('email', v_email));
  return query select v_token, v_email;
end $$;

create function public.reject_join_request(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'members.manage');
  update public.join_requests set status = 'rejected', decided_by = app.membership_id(p_org), decided_at = now()
    where org_id = p_org and id = p_id and status = 'pending';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(p_org, 'join_request.rejected', 'join_request', p_id);
end $$;

revoke execute on all functions in schema app from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'record_payment(uuid, integer, bigint, date, text, boolean, text, text, text)', 'void_payment(uuid, integer, text)',
    'confirm_payment(uuid)', 'start_payment_proof(uuid, text, text, integer)',
    'save_bank_account(uuid, text, text, text)', 'remove_bank_account(uuid)', 'my_bank_account(uuid)',
    'reveal_bank_account(uuid)', 'get_request(uuid)', 'my_work(uuid)',
    'list_payable(uuid, text, uuid, text, boolean, integer, integer)',
    'list_payments(uuid, text, text, text, date, date, text, boolean, integer, integer)',
    'get_join_code(uuid)', 'set_join_code(uuid, boolean)', 'list_join_requests(uuid)',
    'approve_join_request(uuid, uuid, uuid, uuid)', 'reject_join_request(uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['claim_emails(integer)', 'finish_email(uuid, smallint, boolean, text)',
    'submit_join_request(text, text, text)', 'verify_join_request(text)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
