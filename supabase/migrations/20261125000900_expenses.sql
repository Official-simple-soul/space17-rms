-- Expenses, the department inbox and monthly expense reports.
-- As with requests, clients never touch these tables; every path is a function that checks access.

create table public.report_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  month date not null check (extract(day from month) = 1),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, month)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  number text,
  kind text not null default 'expense' check (kind in ('expense')),
  period_id uuid not null,
  department_id uuid not null,
  template_version_id uuid,
  form_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(form_data) = 'object' and pg_column_size(form_data) < 100000),
  status text not null default 'draft' check (status in ('draft', 'under_review', 'returned', 'approved')),
  submitted_by uuid,
  submitted_at timestamptz,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, number),
  unique (kind, period_id, department_id),
  foreign key (org_id, period_id) references public.report_periods (org_id, id),
  foreign key (org_id, department_id) references public.departments (org_id, id),
  foreign key (org_id, template_version_id) references public.template_versions (org_id, id),
  foreign key (org_id, submitted_by) references public.memberships (org_id, id),
  check (status = 'draft' or (number is not null and submitted_by is not null and submitted_at is not null))
);
create index reports_department_idx on public.reports (org_id, department_id);
create trigger touch_updated_at before update on public.reports
  for each row execute function app.touch_updated_at();

create table public.expense_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  entered_by uuid not null,
  department_id uuid,
  category_id uuid,
  request_id uuid,
  report_id uuid,
  expense_date date,
  description text not null default '' check (char_length(description) <= 200),
  seller_name text not null default '' check (char_length(seller_name) <= 120),
  seller_location text check (char_length(seller_location) <= 160),
  -- Only ever typed by a person; never generated.
  seller_phone text check (char_length(seller_phone) <= 20),
  total_minor bigint not null default 0 check (total_minor between 0 and 900000000000000),
  funding text not null default 'department' check (funding in ('department', 'personal')),
  paid_by_membership_id uuid,
  no_receipt boolean not null default false,
  no_receipt_reason text check (char_length(no_receipt_reason) <= 500),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'returned', 'rejected', 'accepted', 'locked', 'cancelled')),
  submitted_at timestamptz,
  accepted_by uuid,
  accepted_at timestamptz,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, entered_by) references public.memberships (org_id, id),
  foreign key (org_id, department_id) references public.departments (org_id, id),
  foreign key (org_id, category_id) references public.categories (org_id, id),
  foreign key (org_id, request_id) references public.requests (org_id, id),
  foreign key (org_id, report_id) references public.reports (org_id, id),
  foreign key (org_id, paid_by_membership_id) references public.memberships (org_id, id),
  foreign key (org_id, accepted_by) references public.memberships (org_id, id),
  check ((status in ('accepted', 'locked')) = (report_id is not null)),
  check ((funding = 'personal') = (paid_by_membership_id is not null)),
  check (status in ('draft', 'cancelled') or (department_id is not null and category_id is not null
    and expense_date is not null and total_minor > 0 and submitted_at is not null))
);
create index expense_lines_report_idx on public.expense_lines (report_id);
create index expense_lines_department_idx on public.expense_lines (org_id, department_id, status);
create index expense_lines_enterer_idx on public.expense_lines (entered_by, status);
create index expense_lines_match_idx on public.expense_lines (org_id, expense_date, total_minor);
create index expense_lines_request_idx on public.expense_lines (request_id);
create trigger touch_updated_at before update on public.expense_lines
  for each row execute function app.touch_updated_at();

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  expense_line_id uuid not null,
  position smallint not null check (position between 1 and 50),
  description text not null check (char_length(description) <= 200),
  quantity numeric(12, 3) not null check (quantity between 0 and 100000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 100000000000),
  line_total_minor bigint not null generated always as (round(quantity * unit_price_minor)::bigint) stored,
  unique (expense_line_id, position),
  foreign key (org_id, expense_line_id) references public.expense_lines (org_id, id) on delete cascade
);

create table public.expense_events (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  expense_line_id uuid not null,
  actor_id uuid not null,
  type text not null check (type in ('submitted', 'accepted', 'returned', 'rejected', 'withdrawn', 'removed', 'evidence_added')),
  body text check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (org_id, expense_line_id) references public.expense_lines (org_id, id),
  foreign key (org_id, actor_id) references public.memberships (org_id, id)
);
create index expense_events_line_idx on public.expense_events (expense_line_id, id);

create table public.report_events (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  report_id uuid not null,
  actor_id uuid not null,
  type text not null check (type in ('submitted')),
  body text check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  foreign key (org_id, report_id) references public.reports (org_id, id),
  foreign key (org_id, actor_id) references public.memberships (org_id, id)
);
create index report_events_report_idx on public.report_events (report_id, id);

create trigger expense_events_append_only before update or delete on public.expense_events
  for each row execute function app.block_mutation();
create trigger report_events_append_only before update or delete on public.report_events
  for each row execute function app.block_mutation();

create table public.report_reminders (
  org_id uuid not null,
  department_id uuid not null,
  month date not null,
  kind text not null check (kind in ('soon', 'today', 'late')),
  created_at timestamptz not null default now(),
  primary key (department_id, month, kind),
  foreign key (org_id, department_id) references public.departments (org_id, id)
);

alter table public.attachments alter column request_id drop not null,
  add column expense_line_id uuid,
  add column report_id uuid,
  add foreign key (org_id, expense_line_id) references public.expense_lines (org_id, id) on delete cascade,
  add foreign key (org_id, report_id) references public.reports (org_id, id),
  add check (num_nonnulls(request_id, expense_line_id, report_id) = 1);
create index attachments_expense_idx on public.attachments (expense_line_id) where expense_line_id is not null;
create index attachments_report_idx on public.attachments (report_id) where report_id is not null;

alter table public.notifications
  add column expense_line_id uuid, add column report_id uuid,
  add foreign key (org_id, expense_line_id) references public.expense_lines (org_id, id),
  add foreign key (org_id, report_id) references public.reports (org_id, id);

alter table public.organisations add column report_due_day smallint not null default 5 check (report_due_day between 1 and 28);

do $$
declare t text;
begin
  foreach t in array array['report_periods', 'reports', 'expense_lines', 'expense_items', 'expense_events',
    'report_events', 'report_reminders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Helpers -------------------------------------------------------------------

create function app.today(p_org uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone timezone)::date from public.organisations where id = p_org
$$;

-- Everything that changes what a department's reports contain takes this lock first.
create function app.lock_department(p_department uuid) returns void
language sql security definer set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('department-reports:' || p_department, 0))
$$;

create function app.department_holders(p_org uuid, p_key text, p_department uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct g.membership_id from app.current_grants(p_org) g
  join public.role_permissions rp on rp.role_id = g.role_id and rp.permission_key = p_key
  where (rp.scope = 'org' and g.department_id is null) or (rp.scope = 'department' and g.department_id = p_department)
$$;

create function app.has_vendor_receipt(p_line uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.attachments a where a.expense_line_id = p_line and a.kind = 'vendor_receipt'
    and a.ready_at is not null and a.removed_at is null)
$$;

-- Derived, so it can never disagree with the files.
create function app.evidence_of(p_line uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when app.has_vendor_receipt(p_line) then 'vendor_receipt' else 'missing' end
$$;

create function app.can_view_expense(p public.expense_lines) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p.org_id);
begin
  if v_me = p.entered_by then return true; end if;
  if p.submitted_at is null then return false; end if;
  if app.has_support_access(p.org_id) then return true; end if;
  if v_me is null then return false; end if;
  return app.has_perm(p.org_id, 'expenses.view', p.department_id)
    or app.has_perm(p.org_id, 'expenses.accept', p.department_id)
    or (p.report_id is not null and (app.has_perm(p.org_id, 'reports.view', p.department_id)
      or app.has_perm(p.org_id, 'reports.review', p.department_id)));
end $$;

create function app.can_view_report(p public.reports) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_support_access(p.org_id) or app.has_perm(p.org_id, 'reports.view', p.department_id)
    or app.has_perm(p.org_id, 'reports.submit', p.department_id) or app.has_perm(p.org_id, 'reports.review', p.department_id)
$$;

-- Reasons to look twice. They inform people and never block on their own.
create function app.expense_flags(p public.expense_lines) returns text[]
language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when app.evidence_of(p.id) = 'missing' then 'missing_receipt' end,
    case when exists (select 1 from public.expense_lines x where x.org_id = p.org_id and x.id <> p.id
      and x.expense_date = p.expense_date and x.total_minor = p.total_minor
      and lower(btrim(x.seller_name)) = lower(btrim(p.seller_name)) and x.submitted_at is not null
      and x.status not in ('rejected', 'cancelled')) then 'duplicate' end,
    case when exists (select 1 from public.attachments a join public.attachments b on b.org_id = a.org_id and b.sha256 = a.sha256
      join public.expense_lines x on x.id = b.expense_line_id and x.id <> p.id and x.submitted_at is not null
        and x.status not in ('rejected', 'cancelled')
      where a.expense_line_id = p.id and a.ready_at is not null and a.removed_at is null
        and b.ready_at is not null and b.removed_at is null) then 'duplicate_file' end,
    case when p.funding = 'personal' and p.request_id is not null and app.paid_minor(p.request_id) > 0
      then 'already_paid' end,
    case when p.report_id is not null and date_trunc('month', p.expense_date)::date <> (select pe.month from public.reports r
      join public.report_periods pe on pe.id = r.period_id where r.id = p.report_id) then 'other_month' end
  ], null)
$$;

create function app.expense_payload(p public.expense_lines) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', p.description, 'requester', app.member_name(p.entered_by),
    'actor', app.member_name(app.membership_id(p.org_id)))
$$;

create function app.notify_about(p_org uuid, p_members uuid[], p_type text, p_expense uuid, p_report uuid, p_payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (org_id, membership_id, type, expense_line_id, report_id, payload)
  select p_org, m.id, p_type, p_expense, p_report, p_payload
  from public.memberships m
  where m.org_id = p_org and m.status = 'active' and m.id = any (p_members)
    and m.id is distinct from app.membership_id(p_org)
$$;

create function app.ensure_period(p_org uuid, p_month date) returns public.report_periods
language plpgsql security definer set search_path = '' as $$
declare v public.report_periods;
begin
  insert into public.report_periods (org_id, month, due_date)
    select p_org, p_month, (p_month + interval '1 month')::date + (o.report_due_day - 1) from public.organisations o where o.id = p_org
    on conflict (org_id, month) do nothing;
  select * into v from public.report_periods where org_id = p_org and month = p_month for share;
  return v;
end $$;

create function app.ensure_report(p_org uuid, p_department uuid, p_month date) returns public.reports
language plpgsql security definer set search_path = '' as $$
declare v public.reports; pe public.report_periods;
begin
  pe := app.ensure_period(p_org, p_month);
  select * into v from public.reports where period_id = pe.id and department_id = p_department and kind = 'expense' for update;
  if v.id is null and pe.status = 'open' then
    insert into public.reports (org_id, period_id, department_id) values (p_org, pe.id, p_department) returning * into v;
    perform app.write_audit(p_org, 'report.opened', 'report', v.id, null, jsonb_build_object('month', p_month));
  end if;
  return v;
end $$;

-- The report an expense belongs in: its own month while that is still open, otherwise the next one that is.
-- The caller holds the department lock.
create function app.report_for(p_org uuid, p_department uuid, p_date date) returns public.reports
language plpgsql security definer set search_path = '' as $$
declare
  v public.reports; v_month date := date_trunc('month', p_date)::date;
  v_now date := date_trunc('month', app.today(p_org))::date;
begin
  -- Never starts a report older than last month, but uses one that is already open.
  for v in select r.* from public.reports r join public.report_periods pe on pe.id = r.period_id
    where r.department_id = p_department and r.kind = 'expense' and r.status in ('draft', 'returned') and pe.status = 'open'
      and pe.month >= v_month and pe.month < (v_now - interval '1 month') order by pe.month limit 1 loop
    return v;
  end loop;
  v_month := greatest(v_month, (v_now - interval '1 month')::date);
  while v_month <= (v_now + interval '1 month')::date loop
    v := app.ensure_report(p_org, p_department, v_month);
    if v.status in ('draft', 'returned') and (select status from public.report_periods where id = v.period_id) = 'open' then
      return v;
    end if;
    v_month := (v_month + interval '1 month')::date;
  end loop;
  raise exception 'no_open_report' using errcode = '22023';
end $$;

-- Entering expenses -----------------------------------------------------------

create function public.expense_categories(p_org uuid)
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
  where c.org_id = p_org and c.archived_at is null and c.applies_to <> 'request'
    and (not exists (select 1 from public.category_departments x where x.category_id = c.id)
      or exists (select 1 from public.category_departments x where x.category_id = c.id and x.department_id = dm.department_id))
  group by c.id, c.name order by c.name;
end $$;

-- The caller's approved requests that spending can be linked to.
create function public.linkable_requests(p_org uuid)
returns table (id uuid, number text, title text, department_id uuid, category_id uuid)
language sql stable security definer set search_path = '' as $$
  select r.id, r.number, r.title, r.department_id, r.category_id from public.requests r
  where r.org_id = p_org and r.requester_id = app.membership_id(p_org)
    and r.status in ('approved', 'part_paid', 'paid', 'received')
  order by r.submitted_at desc limit 200
$$;

create function app.lock_own_expense(p_id uuid, p_lock integer) returns public.expense_lines
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines;
begin
  select * into v from public.expense_lines where id = p_id for update;
  if v.id is null or v.entered_by is distinct from app.membership_id(v.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.lock_version is distinct from p_lock then raise exception 'stale_expense' using errcode = '22023'; end if;
  return v;
end $$;

-- Drafts may be incomplete. p_items: ordered [{description, quantity, unit_price_minor}].
create function public.save_expense(
  p_org uuid, p_id uuid, p_category uuid, p_department uuid, p_request uuid, p_date date, p_description text,
  p_seller text, p_location text, p_phone text, p_funding text, p_no_receipt boolean, p_reason text, p_items jsonb, p_lock integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org); v public.expense_lines; v_id uuid := p_id; v_total numeric;
begin
  if not app.has_perm(p_org, 'expenses.create', null, v_me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if p_department is not null and not exists (select 1 from public.department_members dm
    where dm.org_id = p_org and dm.membership_id = v_me and dm.department_id = p_department) then
    raise exception 'department_missing' using errcode = '22023';
  end if;
  if p_category is not null and not exists (select 1 from public.expense_categories(p_org) c
    where c.id = p_category and (p_department is null or p_department = any (c.departments))) then
    raise exception 'category_unavailable' using errcode = '22023';
  end if;
  if p_request is not null and not exists (select 1 from public.linkable_requests(p_org) r where r.id = p_request) then
    raise exception 'request_unavailable' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.expense_lines (org_id, entered_by) values (p_org, v_me) returning id into v_id;
  else
    v := app.lock_own_expense(p_id, p_lock);
    if v.org_id <> p_org or v.status not in ('draft', 'returned') then
      raise exception 'expense_locked' using errcode = '22023';
    end if;
    -- Submitted details stay complete while they are being corrected.
    if v.submitted_at is not null and (p_category is null or p_department is null or p_date is null) then
      raise exception 'expense_incomplete' using errcode = '22023';
    end if;
    delete from public.expense_items where expense_line_id = p_id;
  end if;
  insert into public.expense_items (org_id, expense_line_id, position, description, quantity, unit_price_minor)
  select p_org, v_id, i.n, btrim(coalesce(i.description, '')), coalesce(i.quantity, 0), coalesce(i.unit_price_minor, 0)
  from rows from (jsonb_to_recordset(p_items) as (description text, quantity numeric, unit_price_minor bigint))
    with ordinality as i (description, quantity, unit_price_minor, n);
  select coalesce(sum(line_total_minor), 0) into v_total from public.expense_items where expense_line_id = v_id;
  if v_total > 900000000000000 or (v.submitted_at is not null and v_total <= 0) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  update public.expense_lines set category_id = p_category, department_id = p_department, request_id = p_request,
    expense_date = p_date, description = btrim(coalesce(p_description, '')), seller_name = btrim(coalesce(p_seller, '')),
    seller_location = nullif(btrim(p_location), ''), seller_phone = nullif(btrim(p_phone), ''),
    funding = p_funding, paid_by_membership_id = case when p_funding = 'personal' then v_me end,
    no_receipt = coalesce(p_no_receipt, false), no_receipt_reason = nullif(btrim(p_reason), ''),
    total_minor = v_total::bigint, lock_version = case when p_id is null then 1 else lock_version + 1 end
    where id = v_id returning * into v;
  return jsonb_build_object('id', v_id, 'version', v.lock_version);
end $$;

create function public.delete_expense(p_id uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines; v_paths text[];
begin
  select * into v from public.expense_lines where id = p_id for update;
  if v.id is null or v.entered_by is distinct from app.membership_id(v.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.status <> 'draft' or v.submitted_at is not null then raise exception 'expense_locked' using errcode = '22023'; end if;
  select coalesce(array_agg(storage_path), '{}') into v_paths from public.attachments where expense_line_id = p_id;
  delete from public.expense_lines where id = p_id;
  return v_paths;
end $$;

-- Puts a line into its report. The caller holds the department lock and the line.
create function app.accept_line(p public.expense_lines) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reports; v_me uuid := app.membership_id(p.org_id);
begin
  r := app.report_for(p.org_id, p.department_id, p.expense_date);
  update public.expense_lines set status = 'accepted', report_id = r.id, accepted_by = v_me, accepted_at = now(),
    lock_version = lock_version + 1 where id = p.id;
  update public.reports set lock_version = lock_version + 1 where id = r.id;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type) values (p.org_id, p.id, v_me, 'accepted');
  perform app.write_audit(p.org_id, 'expense.accepted', 'expense', p.id, null,
    jsonb_build_object('total_minor', p.total_minor, 'report_id', r.id));
end $$;

create function public.submit_expense(p_id uuid, p_lock integer) returns text
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
  if not exists (select 1 from app.department_holders(v.org_id, 'expenses.accept', v.department_id)) then
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
  perform app.notify_about(v.org_id, array(select app.department_holders(v.org_id, 'expenses.accept', v.department_id)),
    'expense_submitted', p_id, null, app.expense_payload(v));
  return 'submitted';
end $$;

create function public.withdraw_expense(p_id uuid, p_lock integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines;
begin
  v := app.lock_own_expense(p_id, p_lock);
  if v.status not in ('submitted', 'returned') then raise exception 'expense_locked' using errcode = '22023'; end if;
  update public.expense_lines set status = 'cancelled', lock_version = lock_version + 1 where id = p_id;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type) values (v.org_id, p_id, v.entered_by, 'withdrawn');
  perform app.write_audit(v.org_id, 'expense.withdrawn', 'expense', p_id);
end $$;

-- Department inbox --------------------------------------------------------------

create function public.decide_expense(p_id uuid, p_lock integer, p_action text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines; v_me uuid;
begin
  select * into v from public.expense_lines where id = p_id;
  if v.id is null or not app.can_view_expense(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(v.org_id);
  if not app.has_perm(v.org_id, 'expenses.accept', v.department_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform app.lock_department(v.department_id);
  select * into v from public.expense_lines where id = p_id for update;
  -- The line may have moved department while we waited.
  if not app.has_perm(v.org_id, 'expenses.accept', v.department_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v.lock_version is distinct from p_lock or v.status <> 'submitted' then
    raise exception 'stale_expense' using errcode = '22023';
  end if;
  if p_action = 'accept' then perform app.accept_line(v); return; end if;
  if p_action is null or p_action not in ('return', 'reject') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  update public.expense_lines set status = case p_action when 'return' then 'returned' else 'rejected' end,
    lock_version = lock_version + 1 where id = p_id returning * into v;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
    values (v.org_id, p_id, v_me, v.status, btrim(p_reason));
  perform app.notify_about(v.org_id, array[v.entered_by], 'expense_' || v.status, p_id, null, app.expense_payload(v));
  perform app.write_audit(v.org_id, 'expense.' || v.status, 'expense', p_id, null, null, btrim(p_reason));
end $$;

-- Lines that may be accepted together: a vendor receipt and nothing to look at twice.
create function public.ready_expenses(p_org uuid)
returns table (id uuid, lock_version integer, total_minor bigint)
language sql stable security definer set search_path = '' as $$
  select e.id, e.lock_version, e.total_minor from public.expense_lines e
  where e.org_id = p_org and e.status = 'submitted' and app.has_perm(p_org, 'expenses.accept', e.department_id)
    and cardinality(app.expense_flags(e)) = 0
  order by e.submitted_at, e.id limit 100
$$;

-- p_lines: [{id, lock_version}], exactly as shown to the person. All or nothing.
create function public.accept_expenses(p_org uuid, p_lines jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines; x record; v_count integer := 0; v_dept uuid;
begin
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception 'stale_expense' using errcode = '22023';
  end if;
  for v_dept in select distinct e.department_id from public.expense_lines e
    join jsonb_to_recordset(p_lines) as l (id uuid) on l.id = e.id
    where e.org_id = p_org and e.department_id is not null order by 1 loop
    if not app.has_perm(p_org, 'expenses.accept', v_dept) then raise exception 'not_allowed' using errcode = '42501'; end if;
    perform app.lock_department(v_dept);
  end loop;
  for x in select distinct l.id, l.lock_version from jsonb_to_recordset(p_lines) as l (id uuid, lock_version integer) order by l.id loop
    select * into v from public.expense_lines e where e.id = x.id and e.org_id = p_org for update;
    if v.id is null or not app.has_perm(p_org, 'expenses.accept', v.department_id) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if v.status <> 'submitted' or v.lock_version is distinct from x.lock_version or cardinality(app.expense_flags(v)) > 0 then
      raise exception 'stale_expense' using errcode = '22023';
    end if;
    perform app.accept_line(v);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create function public.remove_report_line(p_id uuid, p_lock integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines; r public.reports; v_me uuid;
begin
  select * into v from public.expense_lines where id = p_id;
  if v.id is null or not app.can_view_expense(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(v.org_id);
  if not app.has_perm(v.org_id, 'expenses.accept', v.department_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform app.lock_department(v.department_id);
  select * into v from public.expense_lines where id = p_id for update;
  if v.lock_version is distinct from p_lock or v.status <> 'accepted' then raise exception 'stale_expense' using errcode = '22023'; end if;
  select * into r from public.reports where id = v.report_id for update;
  if r.status not in ('draft', 'returned') then raise exception 'report_locked' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  update public.expense_lines set status = 'returned', report_id = null, accepted_by = null, accepted_at = null,
    lock_version = lock_version + 1 where id = p_id;
  update public.reports set lock_version = lock_version + 1 where id = r.id;
  insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
    values (v.org_id, p_id, v_me, 'removed', btrim(p_reason));
  perform app.notify_about(v.org_id, array[v.entered_by], 'expense_returned', p_id, null, app.expense_payload(v));
  perform app.write_audit(v.org_id, 'expense.removed', 'expense', p_id, jsonb_build_object('report_id', r.id), null, btrim(p_reason));
end $$;

-- Files -----------------------------------------------------------------------

-- Evidence may still be added, never removed, once accepted and until the report is submitted.
create function app.can_add_evidence(p public.expense_lines) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(case
    when p.status in ('draft', 'returned') then p.entered_by = app.membership_id(p.org_id)
    when p.status = 'accepted' then (p.entered_by = app.membership_id(p.org_id) or app.has_perm(p.org_id, 'expenses.accept', p.department_id))
      and (select r.status in ('draft', 'returned') from public.reports r where r.id = p.report_id)
    else false end, false)
$$;

create function app.can_edit_report(p public.reports) returns boolean
language sql stable security definer set search_path = '' as $$
  select p.status in ('draft', 'returned') and app.has_perm(p.org_id, 'reports.submit', p.department_id)
    and (select pe.status = 'open' from public.report_periods pe where pe.id = p.period_id)
$$;

create function public.start_expense_file(p_expense uuid, p_kind text, p_name text, p_mime text, p_size integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.expense_lines; v_id uuid := gen_random_uuid(); v_path text;
begin
  select * into v from public.expense_lines where id = p_expense for update;
  if v.id is null or not app.can_view_expense(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not app.can_add_evidence(v) then raise exception 'expense_locked' using errcode = '22023'; end if;
  if (select count(*) from public.attachments where expense_line_id = p_expense and removed_at is null
    and (ready_at is not null or created_at > now() - interval '15 minutes')) >= 10 then
    raise exception 'too_many_evidence' using errcode = '22023';
  end if;
  v_path := v.org_id || '/expenses/' || p_expense || '/' || v_id;
  insert into public.attachments (id, org_id, expense_line_id, kind, storage_path, file_name, mime, size, uploaded_by)
    values (v_id, v.org_id, p_expense, p_kind, v_path, right(btrim(p_name), 160), p_mime, p_size, app.membership_id(v.org_id));
  return jsonb_build_object('id', v_id, 'path', v_path);
end $$;

create function public.start_report_file(p_report uuid, p_field text, p_name text, p_mime text, p_size integer) returns jsonb
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
  if p_field is not null and not exists (
    select 1 from public.template_versions tv, jsonb_array_elements(tv.fields) f
    where tv.id = v.template_version_id and f ->> 'key' = p_field and f ->> 'type' = 'file') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_path := v.org_id || '/reports/' || p_report || '/' || v_id;
  insert into public.attachments (id, org_id, report_id, field_key, storage_path, file_name, mime, size, uploaded_by)
    values (v_id, v.org_id, p_report, p_field, v_path, right(btrim(p_name), 160), p_mime, p_size, app.membership_id(v.org_id));
  return jsonb_build_object('id', v_id, 'path', v_path);
end $$;

-- Called by the server only after it has checked the stored bytes and the uploader's session. The record is locked
-- first, so a file cannot slip in after submission.
create or replace function public.finish_attachment(p_id uuid, p_size integer, p_sha256 text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.attachments; e public.expense_lines; v_ok boolean;
begin
  select * into a from public.attachments where id = p_id and ready_at is null;
  if a.payment_id is not null then
    select p.status = 'recorded' into v_ok from public.payments p where p.id = a.payment_id for share;
  elsif a.request_id is not null then
    select r.status in ('draft', 'returned') into v_ok from public.requests r where r.id = a.request_id for share;
  elsif a.expense_line_id is not null then
    select * into e from public.expense_lines where id = a.expense_line_id for update;
    v_ok := e.status in ('draft', 'returned');
    if e.status = 'accepted' then
      select r.status in ('draft', 'returned') into v_ok from public.reports r where r.id = e.report_id for update;
    end if;
  elsif a.report_id is not null then
    select r.status in ('draft', 'returned') into v_ok from public.reports r where r.id = a.report_id for share;
  end if;
  if not coalesce(v_ok, false) then raise exception 'request_locked' using errcode = '22023'; end if;
  update public.attachments set ready_at = now(), size = p_size, sha256 = p_sha256 where id = p_id and ready_at is null;
  if not found then raise exception 'request_locked' using errcode = '22023'; end if;
  if e.status = 'accepted' then
    update public.reports set lock_version = lock_version + 1 where id = e.report_id;
    insert into public.expense_events (org_id, expense_line_id, actor_id, type, body)
      values (e.org_id, e.id, a.uploaded_by, 'evidence_added', a.file_name);
  end if;
end $$;

create or replace function public.remove_attachment(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare a public.attachments; r public.requests; e public.expense_lines; p public.reports; v_me uuid; v_ok boolean; v_sent boolean;
begin
  select * into a from public.attachments where id = p_id and removed_at is null;
  if a.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(a.org_id);
  if a.request_id is not null then
    select * into r from public.requests where id = a.request_id for update;
    if r.requester_id is distinct from v_me then raise exception 'not_found' using errcode = 'P0002'; end if;
    v_ok := a.payment_id is null and r.status in ('draft', 'returned'); v_sent := r.submitted_at is not null;
  elsif a.expense_line_id is not null then
    select * into e from public.expense_lines where id = a.expense_line_id for update;
    if e.entered_by is distinct from v_me then raise exception 'not_found' using errcode = 'P0002'; end if;
    v_ok := e.status in ('draft', 'returned'); v_sent := e.submitted_at is not null;
  else
    select * into p from public.reports where id = a.report_id for update;
    if not app.has_perm(p.org_id, 'reports.submit', p.department_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
    v_ok := app.can_edit_report(p); v_sent := p.submitted_at is not null;
  end if;
  if not v_ok then raise exception 'request_locked' using errcode = '22023'; end if;
  if not v_sent then
    delete from public.attachments where id = p_id;
    return a.storage_path;
  end if;
  update public.attachments set removed_at = now() where id = p_id;
  return null;
end $$;

create or replace function public.get_attachment(p_id uuid) returns table (storage_path text, file_name text, mime text)
language plpgsql stable security definer set search_path = '' as $$
declare a public.attachments;
begin
  select * into a from public.attachments x where x.id = p_id and x.ready_at is not null and x.removed_at is null;
  if a.id is null then return; end if;
  if a.request_id is not null then
    perform app.get_visible_request(a.request_id);
  elsif not exists (select 1 from public.expense_lines e where e.id = a.expense_line_id and app.can_view_expense(e))
    and not exists (select 1 from public.reports r where r.id = a.report_id and app.can_view_report(r)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return query select a.storage_path, a.file_name, a.mime;
end $$;

create or replace function app.assert_form(p_fields jsonb, p_form jsonb, p_request uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare f jsonb; v jsonb; v_text text; v_ok boolean; v_blank boolean;
begin
  for f in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    v := p_form -> (f ->> 'key');
    v_text := v #>> '{}';
    if f ->> 'type' = 'file' then
      v_blank := not exists (select 1 from public.attachments a where (a.request_id = p_request or a.report_id = p_request)
        and a.payment_id is null and a.field_key = f ->> 'key' and a.ready_at is not null and a.removed_at is null);
      v_ok := true;
    else
      v_blank := v is null or v_text is null or btrim(v_text) = '' or v = 'false'::jsonb;
      v_ok := v_blank or case f ->> 'type'
        when 'short_text' then jsonb_typeof(v) = 'string' and char_length(v_text) <= 200
        when 'long_text' then jsonb_typeof(v) = 'string' and char_length(v_text) <= 5000
        when 'number' then jsonb_typeof(v) = 'number'
        when 'money' then jsonb_typeof(v) = 'number' and v_text ~ '^\d{1,15}$'
        when 'checkbox' then jsonb_typeof(v) = 'boolean'
        when 'dropdown' then jsonb_typeof(v) = 'string' and f -> 'options' @> jsonb_build_array(v)
        when 'date' then jsonb_typeof(v) = 'string' and v_text ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(v_text, 'date')
        else false end;
    end if;
    if not coalesce(v_ok, false) or (v_blank and (f ->> 'required')::boolean) then
      raise exception 'form_invalid' using errcode = '22023';
    end if;
  end loop;
end $$;

-- Reports -----------------------------------------------------------------------

-- The oldest active expense report template is the one reports use.
create function app.report_template(p_org uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select t.current_version_id from public.templates t
  where t.org_id = p_org and t.kind = 'expense_report' and t.archived_at is null and t.current_version_id is not null
  order by t.created_at, t.id limit 1
$$;

create function public.open_report(p_org uuid, p_department uuid, p_month date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.reports; v_now date;
begin
  if not app.has_perm(p_org, 'reports.submit', p_department) then raise exception 'not_allowed' using errcode = '42501'; end if;
  v_now := date_trunc('month', app.today(p_org))::date;
  if p_month is null or p_month not in (v_now, (v_now - interval '1 month')::date) then
    raise exception 'invalid_month' using errcode = '22023';
  end if;
  if exists (select 1 from public.departments where id = p_department and archived_at is not null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform app.lock_department(p_department);
  v := app.ensure_report(p_org, p_department, p_month);
  if v.id is null then raise exception 'report_locked' using errcode = '22023'; end if;
  return v.id;
end $$;

create function app.lock_report(p_id uuid, p_lock integer) returns public.reports
language plpgsql security definer set search_path = '' as $$
declare v public.reports;
begin
  select * into v from public.reports where id = p_id;
  if v.id is null or not app.can_view_report(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.lock_department(v.department_id);
  select * into v from public.reports where id = p_id for update;
  if not app.has_perm(v.org_id, 'reports.submit', v.department_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v.lock_version is distinct from p_lock then raise exception 'stale_report' using errcode = '22023'; end if;
  if not app.can_edit_report(v) then raise exception 'report_locked' using errcode = '22023'; end if;
  return v;
end $$;

create function public.save_report(p_id uuid, p_lock integer, p_form jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.reports; v_version uuid; v_form jsonb;
begin
  v := app.lock_report(p_id, p_lock);
  if jsonb_typeof(p_form) is distinct from 'object' then raise exception 'form_invalid' using errcode = '22023'; end if;
  v_version := app.report_template(v.org_id);
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_form from jsonb_each(p_form) e
    where exists (select 1 from public.template_versions tv, jsonb_array_elements(tv.fields) f
      where tv.id = v_version and f ->> 'key' = e.key and f ->> 'type' <> 'file');
  update public.reports set form_data = v_form, template_version_id = v_version, lock_version = lock_version + 1
    where id = p_id returning * into v;
  return jsonb_build_object('id', p_id, 'version', v.lock_version);
end $$;

create function public.submit_report(p_id uuid, p_lock integer, p_confirm_missing boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.reports; pe public.report_periods; v_me uuid; v_total bigint; v_missing bigint; v_name text;
begin
  v := app.lock_report(p_id, p_lock);
  v_me := app.membership_id(v.org_id);
  select * into pe from public.report_periods where id = v.period_id;
  if pe.month > app.today(v.org_id) then raise exception 'invalid_month' using errcode = '22023'; end if;
  if v.template_version_id is distinct from app.report_template(v.org_id) then
    raise exception 'template_changed' using errcode = '22023';
  end if;
  perform app.assert_form((select fields from public.template_versions where id = v.template_version_id), v.form_data, p_id);
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

create function public.set_report_due_day(p_org uuid, p_day smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before smallint;
begin
  perform app.require_perm(p_org, 'org.manage');
  select report_due_day into v_before from public.organisations where id = p_org for update;
  update public.organisations set report_due_day = p_day where id = p_org;
  -- Deadlines that have passed stay as they were.
  update public.report_periods set due_date = (month + interval '1 month')::date + (p_day - 1)
    where org_id = p_org and status = 'open' and due_date >= app.today(p_org);
  perform app.write_audit(p_org, 'organisation.report_due_day', 'organisation', p_org,
    jsonb_build_object('day', v_before), jsonb_build_object('day', p_day));
end $$;

-- Reading -----------------------------------------------------------------------

create function app.expense_row(p public.expense_lines) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'description', p.description, 'seller', p.seller_name, 'date', p.expense_date,
    'total_minor', p.total_minor, 'funding', p.funding, 'status', p.status, 'evidence', app.evidence_of(p.id),
    'flags', to_jsonb(app.expense_flags(p)), 'by', app.member_name(p.entered_by),
    'category', (select name from public.categories where id = p.category_id))
$$;

create function public.get_expense(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.expense_lines; v_me uuid; v_open boolean;
begin
  select * into v from public.expense_lines where id = p_id;
  if v.id is null or not app.can_view_expense(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(v.org_id);
  select r.status in ('draft', 'returned') into v_open from public.reports r where r.id = v.report_id;
  return jsonb_build_object(
    'id', v.id, 'org_id', v.org_id, 'description', v.description, 'date', v.expense_date, 'seller', v.seller_name,
    'location', v.seller_location, 'phone', v.seller_phone, 'total_minor', v.total_minor, 'funding', v.funding,
    'no_receipt', v.no_receipt, 'no_receipt_reason', v.no_receipt_reason, 'status', v.status, 'lock_version', v.lock_version,
    'submitted_at', v.submitted_at, 'evidence', app.evidence_of(v.id), 'flags', to_jsonb(app.expense_flags(v)),
    'currency', (select currency from public.organisations where id = v.org_id),
    'category', (select jsonb_build_object('id', id, 'name', name) from public.categories where id = v.category_id),
    'department', (select jsonb_build_object('id', id, 'name', name) from public.departments where id = v.department_id),
    'request', (select jsonb_build_object('id', r.id, 'number', r.number, 'title', r.title, 'visible', app.can_view_request(r))
      from public.requests r where r.id = v.request_id),
    'report', (select jsonb_build_object('id', r.id, 'number', r.number, 'month', pe.month, 'visible', app.can_view_report(r))
      from public.reports r join public.report_periods pe on pe.id = r.period_id where r.id = v.report_id),
    'by', app.member_name(v.entered_by),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'description', i.description, 'quantity', i.quantity,
      'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor) order by i.position), '[]'::jsonb)
      from public.expense_items i where i.expense_line_id = p_id),
    'attachments', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime, 'size', a.size,
      'field_key', a.kind) order by a.created_at), '[]'::jsonb) from public.attachments a
      where a.expense_line_id = p_id and a.ready_at is not null and a.removed_at is null),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'actor', app.member_name(e.actor_id),
      'body', e.body, 'at', e.created_at) order by e.id desc), '[]'::jsonb) from public.expense_events e where e.expense_line_id = p_id),
    'is_mine', coalesce(v_me = v.entered_by, false),
    'can_decide', v.status = 'submitted' and app.has_perm(v.org_id, 'expenses.accept', v.department_id),
    'can_remove', coalesce(v.status = 'accepted' and v_open and app.has_perm(v.org_id, 'expenses.accept', v.department_id), false),
    'can_add_evidence', v.status = 'accepted' and app.can_add_evidence(v));
end $$;

-- p_view: mine, inbox (waiting for the caller) or all (everything the caller may see except drafts).
create function public.list_expenses(
  p_org uuid, p_view text default 'mine', p_search text default '', p_status text default null, p_category uuid default null,
  p_department uuid default null, p_evidence text default null, p_from date default null, p_to date default null,
  p_sort text default null, p_desc boolean default false, p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, description text, seller text, entered_by text, category text, department text, expense_date date,
  total_minor bigint, funding text, status text, evidence text, flags text[], submitted_at timestamptz, updated_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org); v_all boolean;
begin
  v_all := app.has_perm(p_org, 'expenses.view') or app.has_support_access(p_org);
  if v_me is null and not v_all then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  with found as (
    select e.*, coalesce(c.name, '') as category_name, coalesce(d.name, '') as department_name,
      app.member_name(e.entered_by) as who, app.evidence_of(e.id) as proof
    from public.expense_lines e
    left join public.categories c on c.id = e.category_id
    left join public.departments d on d.id = e.department_id
    where e.org_id = p_org
      and (p_status is null or e.status = p_status)
      and (p_category is null or e.category_id = p_category)
      and (p_department is null or e.department_id = p_department)
      and (p_from is null or e.expense_date >= p_from) and (p_to is null or e.expense_date <= p_to)
      and case p_view
        when 'mine' then e.entered_by = v_me
        when 'inbox' then e.status = 'submitted' and app.has_perm(p_org, 'expenses.accept', e.department_id)
        when 'all' then e.submitted_at is not null and (v_all or app.can_view_expense(e))
        else false end
  ), matched as (
    select f.*, count(*) over () as n from found f
    where (p_evidence is null or f.proof = p_evidence)
      and app.matches(concat_ws(' ', f.description, f.seller_name, f.who, f.category_name, f.department_name), p_search)
    order by
      case when p_sort = 'amount' and not p_desc then f.total_minor end asc,
      case when p_sort = 'amount' and p_desc then f.total_minor end desc,
      case when p_sort in ('description', 'by', 'category', 'status') and not p_desc then lower(case p_sort
        when 'description' then f.description when 'by' then f.who when 'category' then f.category_name else f.status end) end asc,
      case when p_sort in ('description', 'by', 'category', 'status') and p_desc then lower(case p_sort
        when 'description' then f.description when 'by' then f.who when 'category' then f.category_name else f.status end) end desc,
      case when p_sort = 'date' and not p_desc then f.expense_date end asc,
      case when p_sort = 'date' and p_desc then f.expense_date end desc nulls last,
      case when p_view = 'inbox' then f.submitted_at end asc,
      coalesce(f.submitted_at, f.created_at) desc, f.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
  )
  select m.id, m.description, m.seller_name, m.who, m.category_name, m.department_name, m.expense_date, m.total_minor, m.funding,
    m.status, m.proof, app.expense_flags(e), m.submitted_at, m.updated_at, m.n
  from matched m join public.expense_lines e on e.id = m.id
  order by
    case when p_sort = 'amount' and not p_desc then m.total_minor end asc,
    case when p_sort = 'amount' and p_desc then m.total_minor end desc,
    case when p_sort in ('description', 'by', 'category', 'status') and not p_desc then lower(case p_sort
      when 'description' then m.description when 'by' then m.who when 'category' then m.category_name else m.status end) end asc,
    case when p_sort in ('description', 'by', 'category', 'status') and p_desc then lower(case p_sort
      when 'description' then m.description when 'by' then m.who when 'category' then m.category_name else m.status end) end desc,
    case when p_sort = 'date' and not p_desc then m.expense_date end asc,
    case when p_sort = 'date' and p_desc then m.expense_date end desc nulls last,
    case when p_view = 'inbox' then m.submitted_at end asc,
    coalesce(m.submitted_at, m.created_at) desc, m.id;
end $$;

-- Spending already entered against a request.
create function public.request_expenses(p_request uuid)
returns table (id uuid, description text, expense_date date, total_minor bigint, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.get_visible_request(p_request);
  return query select e.id, e.description, e.expense_date, e.total_minor, e.status from public.expense_lines e
    where e.request_id = p_request and e.status not in ('rejected', 'cancelled') and app.can_view_expense(e)
    order by e.expense_date, e.id;
end $$;

-- The caller's departments for last month and this month, whether or not a report has been started.
create function public.my_report_months(p_org uuid)
returns table (department_id uuid, department text, month date, due_date date, overdue boolean, report_id uuid, status text,
  total_minor bigint, lines bigint, missing bigint, waiting bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := app.today(p_org); v_now date;
begin
  v_now := date_trunc('month', v_today)::date;
  return query
  select d.id, d.name, m.month::date, x.due, coalesce(r.status, 'draft') in ('draft', 'returned') and x.due < v_today, r.id, r.status,
    coalesce(s.total, 0)::bigint, coalesce(s.n, 0), coalesce(s.miss, 0),
    (select count(*) from public.expense_lines e where e.org_id = p_org and e.department_id = d.id and e.status = 'submitted')
  from public.departments d
  cross join (values (v_now), ((v_now - interval '1 month')::date)) m (month)
  join public.organisations o on o.id = p_org
  left join public.report_periods pe on pe.org_id = p_org and pe.month = m.month
  left join public.reports r on r.period_id = pe.id and r.department_id = d.id and r.kind = 'expense'
  cross join lateral (select coalesce(pe.due_date, (m.month + interval '1 month')::date + (o.report_due_day - 1)) as due) x
  left join lateral (select sum(e.total_minor) as total, count(*) as n, count(*) filter (where app.evidence_of(e.id) = 'missing') as miss
    from public.expense_lines e where e.report_id = r.id) s on true
  where d.org_id = p_org and d.archived_at is null and app.has_perm(p_org, 'reports.submit', d.id)
    and (r.id is not null or (coalesce(pe.status, 'open') = 'open' and (d.created_at at time zone o.timezone)::date < (m.month + interval '1 month')::date))
  order by d.name, m.month desc;
end $$;

create function public.list_reports(
  p_org uuid, p_search text default '', p_status text default null, p_department uuid default null, p_month date default null,
  p_sort text default null, p_desc boolean default false, p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, number text, department text, month date, due_date date, status text, overdue boolean, total_minor bigint,
  lines bigint, missing bigint, submitted_at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := app.today(p_org);
begin
  if not (app.is_member(p_org) or app.has_support_access(p_org)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  with found as (
    select r.id, r.number, d.name as department_name, pe.month as period_month, pe.due_date as due, r.status, r.submitted_at as sent,
      coalesce(s.sum, 0)::bigint as amount, s.n, s.miss
    from public.reports r
    join public.report_periods pe on pe.id = r.period_id
    join public.departments d on d.id = r.department_id
    cross join lateral (select sum(e.total_minor) as sum, count(*) as n, count(*) filter (where app.evidence_of(e.id) = 'missing') as miss
      from public.expense_lines e where e.report_id = r.id) s
    where r.org_id = p_org and app.can_view_report(r)
      and (p_status is null or r.status = p_status)
      and (p_department is null or r.department_id = p_department)
      and (p_month is null or pe.month = p_month)
  )
  select f.id, f.number, f.department_name, f.period_month, f.due, f.status, f.status in ('draft', 'returned') and f.due < v_today,
    f.amount, f.n, f.miss, f.sent, count(*) over ()
  from found f
  where app.matches(concat_ws(' ', f.number, f.department_name, to_char(f.period_month, 'FMMonth YYYY')), p_search)
  order by
    case when p_sort = 'amount' and not p_desc then f.amount end asc,
    case when p_sort = 'amount' and p_desc then f.amount end desc,
    case when p_sort in ('department', 'status') and not p_desc then lower(case p_sort when 'department' then f.department_name else f.status end) end asc,
    case when p_sort in ('department', 'status') and p_desc then lower(case p_sort when 'department' then f.department_name else f.status end) end desc,
    case when p_sort = 'month' and not p_desc then f.period_month end asc,
    f.period_month desc, f.department_name, f.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create function public.get_report(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.reports; pe public.report_periods; v_edit boolean; v_version uuid; v_lines jsonb;
begin
  select * into v from public.reports where id = p_id;
  if v.id is null or not app.can_view_report(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into pe from public.report_periods where id = v.period_id;
  v_edit := app.can_edit_report(v);
  -- Editors always see the current questions; everyone else sees the ones that were answered.
  v_version := case when v_edit then app.report_template(v.org_id) else v.template_version_id end;
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
    'fields', coalesce((select fields from public.template_versions where id = v_version), '[]'::jsonb),
    'form_data', v.form_data, 'lines', v_lines,
    'attachments', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.file_name, 'mime', a.mime, 'size', a.size,
      'field_key', a.field_key) order by a.created_at), '[]'::jsonb) from public.attachments a
      where a.report_id = p_id and a.ready_at is not null and a.removed_at is null),
    'waiting', (select count(*) from public.expense_lines e where e.department_id = v.department_id and e.status = 'submitted'
      and app.can_view_expense(e)),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'type', e.type, 'actor', app.member_name(e.actor_id),
      'body', e.body, 'at', e.created_at) order by e.id desc), '[]'::jsonb) from public.report_events e where e.report_id = p_id),
    'can_edit', v_edit);
end $$;

-- Work counts, notifications and email now cover expenses and reports. --------------

drop function public.my_work(uuid);
create function public.my_work(p_org uuid)
returns table (approvals bigint, unread bigint, open_requests bigint, returned bigint, to_confirm bigint, to_pay bigint,
  join_requests bigint, expenses_waiting bigint, expenses_returned bigint, reports_due bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org);
begin
  if v_me is null then
    return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint;
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
      and m.month < date_trunc('month', app.today(p_org))::date);
end $$;

drop function public.list_notifications(uuid, boolean, integer, integer);
create function public.list_notifications(p_org uuid, p_unread boolean default false, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, type text, request_id uuid, expense_id uuid, report_id uuid, payload jsonb, read_at timestamptz,
  created_at timestamptz, total bigint)
language sql stable security definer set search_path = '' as $$
  select n.id, n.type, n.request_id, n.expense_line_id, n.report_id, n.payload, n.read_at, n.created_at, count(*) over ()
  from public.notifications n
  where n.org_id = p_org and n.membership_id = app.membership_id(p_org)
    and (not coalesce(p_unread, false) or n.read_at is null)
  order by n.created_at desc, n.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;

drop function public.mark_notifications_read(uuid, uuid);
-- p_subject: a request, expense or report; everything when null.
create function public.mark_notifications_read(p_org uuid, p_subject uuid default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where org_id = p_org and membership_id = app.membership_id(p_org) and read_at is null
    and (p_subject is null or p_subject in (request_id, expense_line_id, report_id))
$$;

create or replace function app.queue_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('approval_needed', 'request_approved', 'request_returned', 'request_rejected', 'payment_recorded',
    'payment_voided', 'bank_details_changed', 'join_request', 'expense_returned', 'expense_rejected', 'report_submitted',
    'report_due_soon', 'report_due_today', 'report_late') then
    insert into public.email_outbox (notification_id) values (new.id);
  end if;
  return new;
end $$;

drop function public.claim_emails(integer);
create function public.claim_emails(p_limit integer default 20)
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
  with batch as (
    update public.email_outbox o set attempts = o.attempts + 1, next_attempt_at = now() + interval '5 minutes'
      where o.id in (select x.id from public.email_outbox x where x.status = 'pending' and x.next_attempt_at <= now()
        order by x.next_attempt_at limit least(greatest(p_limit, 1), 50) for update skip locked)
      returning o.*
  )
  select b.id, b.attempts, u.email::text, app.member_name(m.id), n.type, n.payload, n.request_id, n.expense_line_id, n.report_id,
    g.name, g.slug
  from batch b join public.notifications n on n.id = b.notification_id
  join public.memberships m on m.id = n.membership_id join auth.users u on u.id = m.user_id
  join public.organisations g on g.id = n.org_id;
end $$;

-- Three days before, on the day, and once when late. Each is sent once per department and month.
create function public.queue_report_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare x record; v_count integer := 0;
begin
  for x in
    select o.id as org_id, d.id as department_id, d.name, m.month, r.id as report_id, t.today,
      case when t.today between due.day - 3 and due.day - 1 then 'soon' when t.today = due.day then 'today' else 'late' end as kind
    from public.organisations o
    cross join lateral (select (now() at time zone o.timezone)::date as today) t
    cross join lateral (values (date_trunc('month', t.today)::date), ((date_trunc('month', t.today) - interval '1 month')::date)) m (month)
    join public.departments d on d.org_id = o.id and d.archived_at is null
      and (d.created_at at time zone o.timezone)::date < (m.month + interval '1 month')::date
    left join public.report_periods pe on pe.org_id = o.id and pe.month = m.month
    left join public.reports r on r.period_id = pe.id and r.department_id = d.id and r.kind = 'expense'
    cross join lateral (select coalesce(pe.due_date, (m.month + interval '1 month')::date + (o.report_due_day - 1)) as day) due
    where o.status <> 'suspended' and coalesce(pe.status, 'open') = 'open' and coalesce(r.status, 'draft') in ('draft', 'returned')
      and t.today between due.day - 3 and due.day + 7
  loop
    insert into public.report_reminders (org_id, department_id, month, kind)
      values (x.org_id, x.department_id, x.month, x.kind) on conflict do nothing;
    if found then
      perform app.notify_about(x.org_id, array(select app.department_holders(x.org_id, 'reports.submit', x.department_id)),
        case x.kind when 'soon' then 'report_due_soon' when 'today' then 'report_due_today' else 'report_late' end, null, x.report_id,
        jsonb_build_object('title', x.name || ', ' || to_char(x.month, 'FMMonth YYYY')));
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

create or replace function app.guard_department_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.categories c where c.org_id = new.org_id and c.archived_at is null and (
      exists (select 1 from public.category_departments x where x.category_id = c.id and x.department_id = new.id)
      or exists (select 1 from public.category_approvers x where x.category_id = c.id and x.department_id = new.id))
  ) then
    raise exception 'department_in_use' using errcode = '22023';
  end if;
  if exists (select 1 from public.expense_lines e where e.department_id = new.id and e.status in ('submitted', 'accepted'))
    or exists (select 1 from public.reports r where r.department_id = new.id and r.status in ('under_review', 'returned')) then
    raise exception 'department_has_expenses' using errcode = '22023';
  end if;
  return new;
end $$;

grant select (report_due_day) on public.organisations to authenticated;
revoke execute on all functions in schema app from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'expense_categories(uuid)', 'linkable_requests(uuid)',
    'save_expense(uuid, uuid, uuid, uuid, uuid, date, text, text, text, text, text, boolean, text, jsonb, integer)',
    'delete_expense(uuid)', 'submit_expense(uuid, integer)', 'withdraw_expense(uuid, integer)',
    'decide_expense(uuid, integer, text, text)', 'ready_expenses(uuid)', 'accept_expenses(uuid, jsonb)',
    'remove_report_line(uuid, integer, text)', 'start_expense_file(uuid, text, text, text, integer)',
    'start_report_file(uuid, text, text, text, integer)', 'open_report(uuid, uuid, date)',
    'save_report(uuid, integer, jsonb)', 'submit_report(uuid, integer, boolean)', 'set_report_due_day(uuid, smallint)',
    'get_expense(uuid)', 'list_expenses(uuid, text, text, text, uuid, uuid, text, date, date, text, boolean, integer, integer)',
    'request_expenses(uuid)', 'my_report_months(uuid)',
    'list_reports(uuid, text, text, uuid, date, text, boolean, integer, integer)', 'get_report(uuid)',
    'my_work(uuid)', 'list_notifications(uuid, boolean, integer, integer)', 'mark_notifications_read(uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['claim_emails(integer)', 'queue_report_reminders()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
