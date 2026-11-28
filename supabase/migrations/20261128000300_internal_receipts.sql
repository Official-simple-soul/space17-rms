-- Cash Purchase Receipts: issued by the organisation for a purchase whose seller gave no receipt.
-- The organisation is always the issuer and the receipt says "Issued internally: vendor receipt unavailable".
-- What it records is frozen when issued: the seller, amounts and date can't change; a mistake is voided and reissued.
-- Whoever entered the expense can't issue its receipt. A public page, reached by the QR code, shows a few details.

create table public.internal_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  number text not null,
  expense_line_id uuid not null,
  status text not null default 'issued' check (status in ('issued', 'voided')),
  -- Everything printed on the receipt, exactly as issued.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  -- Long and random: the QR code's address, which shows only the public details.
  verify_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  issued_by uuid not null,
  issued_at timestamptz not null default now(),
  voided_by uuid,
  voided_at timestamptz,
  void_reason text check (char_length(void_reason) <= 500),
  replaces_id uuid,
  unique (org_id, id),
  unique (org_id, number),
  foreign key (org_id, expense_line_id) references public.expense_lines (org_id, id),
  foreign key (org_id, issued_by) references public.memberships (org_id, id),
  foreign key (org_id, voided_by) references public.memberships (org_id, id),
  foreign key (org_id, replaces_id) references public.internal_receipts (org_id, id),
  check ((status = 'voided') = (voided_by is not null and voided_at is not null and void_reason is not null))
);
create unique index internal_receipts_one_issued on public.internal_receipts (expense_line_id) where status = 'issued';
alter table public.internal_receipts enable row level security;
revoke all on public.internal_receipts from anon, authenticated;

-- Once issued, only the status may change, and only to voided.
create function app.guard_internal_receipt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.snapshot is distinct from old.snapshot or new.number is distinct from old.number
    or new.expense_line_id is distinct from old.expense_line_id or new.issued_by is distinct from old.issued_by
    or new.issued_at is distinct from old.issued_at or new.verify_token is distinct from old.verify_token
    or old.status = 'voided' then
    raise exception 'receipt_immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger internal_receipts_guard before update or delete on public.internal_receipts
  for each row execute function app.guard_internal_receipt();

alter table public.expense_events drop constraint expense_events_type_check;
alter table public.expense_events add constraint expense_events_type_check check (type in ('submitted', 'accepted',
  'returned', 'rejected', 'withdrawn', 'removed', 'evidence_added', 'repaid', 'repayment_voided', 'repayment_confirmed',
  'receipt_issued', 'receipt_voided'));

-- An issued Cash Purchase Receipt counts as evidence.
create or replace function app.evidence_of(p_line uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when app.has_vendor_receipt(p_line) then 'vendor_receipt'
    when exists (select 1 from public.internal_receipts r where r.expense_line_id = p_line and r.status = 'issued')
      then 'internal_receipt'
    else 'missing' end
$$;

-- Finance may issue for a line with no seller's receipt, once it is in a report Finance is checking or has approved.
create function app.can_issue_receipt(p public.expense_lines) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.membership_id(p.org_id) is not null
    and app.membership_id(p.org_id) is distinct from p.entered_by
    and app.has_perm(p.org_id, 'receipts.issue')
    and p.status in ('accepted', 'locked') and not app.has_vendor_receipt(p.id)
    and not exists (select 1 from public.internal_receipts r where r.expense_line_id = p.id and r.status = 'issued')
    and exists (select 1 from public.reports r where r.id = p.report_id and r.status in ('under_review', 'approved'))
$$;

create function public.issue_internal_receipt(p_line uuid, p_lock integer, p_description text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.expense_lines; v_me uuid; v_id uuid; v_number text; v_previous uuid;
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  select * into e from public.expense_lines where id = p_line for update;
  if e.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(e.org_id, 'receipts.issue');
  v_me := app.membership_id(e.org_id);
  if v_me = e.entered_by then raise exception 'own_receipt' using errcode = '42501'; end if;
  if e.lock_version is distinct from p_lock then raise exception 'stale_expense' using errcode = '22023'; end if;
  if not app.can_issue_receipt(e) then raise exception 'cannot_issue' using errcode = '22023'; end if;
  if char_length(coalesce(v_description, '')) > 200 then raise exception 'description_too_long' using errcode = '22023'; end if;
  select id into v_previous from public.internal_receipts where expense_line_id = p_line and status = 'voided'
    order by voided_at desc limit 1;
  v_number := app.next_number(e.org_id, 'internal_receipt');
  insert into public.internal_receipts (org_id, number, expense_line_id, snapshot, issued_by, replaces_id)
  select e.org_id, v_number, p_line, jsonb_build_object(
      'number', v_number,
      'issuer', o.name,
      'currency', o.currency,
      'issued_at', now(),
      'issued_by', app.member_name(v_me),
      'purchase_date', e.expense_date,
      'description', coalesce(v_description, e.description),
      'seller', e.seller_name,
      'location', e.seller_location,
      -- Only ever what a person typed; never made up.
      'phone', nullif(btrim(coalesce(e.seller_phone, '')), ''),
      'reason', e.no_receipt_reason,
      'department', (select name from public.departments where id = e.department_id),
      'entered_by', app.member_name(e.entered_by),
      'items', (select coalesce(jsonb_agg(jsonb_build_object('description', i.description, 'quantity', i.quantity,
        'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor) order by i.position), '[]'::jsonb)
        from public.expense_items i where i.expense_line_id = p_line),
      'total_minor', e.total_minor,
      'replaces', (select number from public.internal_receipts where id = v_previous)),
    v_me, v_previous
  from public.organisations o where o.id = e.org_id
  returning id into v_id;
  update public.expense_lines set lock_version = lock_version + 1 where id = p_line;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
    values (e.org_id, p_line, v_me, 'receipt_issued', v_number);
  perform app.notify_about(e.org_id, array[e.entered_by], 'receipt_issued', p_line, null,
    app.expense_payload(e) || jsonb_build_object('actor', app.member_name(v_me), 'number', v_number));
  perform app.write_audit(e.org_id, 'internal_receipt.issued', 'internal_receipt', v_id, null,
    jsonb_build_object('number', v_number, 'expense', e.description, 'total_minor', e.total_minor));
  return v_id;
end $$;

create function public.void_internal_receipt(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.internal_receipts; e public.expense_lines; v_me uuid;
begin
  select * into r from public.internal_receipts where id = p_id for update;
  select * into e from public.expense_lines where id = r.expense_line_id for update;
  if r.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(r.org_id, 'receipts.void');
  v_me := app.membership_id(r.org_id);
  if v_me = e.entered_by then raise exception 'own_receipt' using errcode = '42501'; end if;
  if r.status <> 'issued' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  -- Locked months keep their receipts.
  if exists (select 1 from public.reports x join public.report_periods pe on pe.id = x.period_id
    where x.id = e.report_id and pe.status = 'closed') then
    raise exception 'period_closed' using errcode = '22023';
  end if;
  update public.internal_receipts set status = 'voided', voided_by = v_me, voided_at = now(), void_reason = btrim(p_reason)
    where id = p_id;
  update public.expense_lines set lock_version = lock_version + 1 where id = e.id;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
    values (r.org_id, e.id, v_me, 'receipt_voided', r.number || ': ' || btrim(p_reason));
  perform app.notify_about(r.org_id, array[e.entered_by, r.issued_by], 'receipt_voided', e.id, null,
    app.expense_payload(e) || jsonb_build_object('actor', app.member_name(v_me), 'number', r.number));
  perform app.write_audit(r.org_id, 'internal_receipt.voided', 'internal_receipt', p_id, jsonb_build_object('status', 'issued'),
    jsonb_build_object('number', r.number), btrim(p_reason));
end $$;

-- The receipt itself, for drawing the PDF: only for people who may see the expense.
create function public.get_internal_receipt(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.internal_receipts; e public.expense_lines;
begin
  select * into r from public.internal_receipts where id = p_id;
  select * into e from public.expense_lines where id = r.expense_line_id;
  if r.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  return r.snapshot || jsonb_build_object('id', r.id, 'org_id', r.org_id, 'status', r.status, 'verify_token', r.verify_token,
    'voided_at', r.voided_at, 'void_reason', r.void_reason);
end $$;

-- What anyone with the QR code may see: enough to check it is genuine, nothing more.
create function public.verify_internal_receipt(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('number', r.number, 'issuer', r.snapshot ->> 'issuer', 'issued_at', r.issued_at,
    'purchase_date', r.snapshot ->> 'purchase_date', 'seller', r.snapshot ->> 'seller',
    'total_minor', (r.snapshot ->> 'total_minor')::bigint, 'currency', r.snapshot ->> 'currency', 'status', r.status,
    'voided_at', r.voided_at)
  from public.internal_receipts r join public.organisations o on o.id = r.org_id
  where r.verify_token = p_token and char_length(p_token) = 36 and o.status <> 'suspended'
$$;

-- The expense page shows its receipts and what Finance may do.
alter function public.get_expense(uuid) set schema app;
alter function app.get_expense(uuid) rename to expense_with_repayment;
create function public.get_expense(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.expense_lines; v_me uuid;
begin
  select * into e from public.expense_lines where id = p_id;
  if e.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(e.org_id);
  return app.expense_with_repayment(p_id) || jsonb_build_object(
    'receipts', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'number', r.number, 'status', r.status,
      'issued_by', app.member_name(r.issued_by), 'issued_at', r.issued_at, 'void_reason', r.void_reason,
      'verify_token', r.verify_token) order by r.issued_at desc), '[]'::jsonb)
      from public.internal_receipts r where r.expense_line_id = p_id),
    'can_issue_receipt', app.can_issue_receipt(e),
    'can_void_receipt', app.has_perm(e.org_id, 'receipts.void') and v_me is not null and v_me <> e.entered_by
      and not exists (select 1 from public.reports x join public.report_periods pe on pe.id = x.period_id
        where x.id = e.report_id and pe.status = 'closed'));
end $$;

revoke execute on all functions in schema app from public, anon;
revoke execute on function app.expense_with_repayment(uuid) from authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'issue_internal_receipt(uuid, integer, text)', 'void_internal_receipt(uuid, text)', 'get_internal_receipt(uuid)',
    'get_expense(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Public, but only through the server, like the other public pages.
revoke execute on function public.verify_internal_receipt(text) from public, anon, authenticated;
grant execute on function public.verify_internal_receipt(text) to service_role;
