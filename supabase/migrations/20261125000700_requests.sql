-- Requests, private attachments, the approval engine and in-app notifications.
-- Clients never read or write these tables; every path is a function that checks access.

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  number text,
  requester_id uuid not null,
  department_id uuid,
  category_id uuid not null,
  template_version_id uuid,
  title text not null default '' check (char_length(title) <= 120),
  purpose text not null default '' check (char_length(purpose) <= 2000),
  form_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(form_data) = 'object' and pg_column_size(form_data) < 100000),
  total_minor bigint not null default 0 check (total_minor between 0 and 900000000000000),
  approved_minor bigint check (approved_minor between 0 and total_minor),
  needed_by date,
  status text not null default 'draft' check (status in ('draft', 'pending', 'returned', 'rejected', 'approved',
    'part_paid', 'paid', 'received', 'accounted', 'closed', 'cancelled')),
  submitted_at timestamptz,
  decided_at timestamptz,
  closed_at timestamptz,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, number),
  foreign key (org_id, requester_id) references public.memberships (org_id, id),
  foreign key (org_id, department_id) references public.departments (org_id, id),
  foreign key (org_id, category_id) references public.categories (org_id, id),
  foreign key (org_id, template_version_id) references public.template_versions (org_id, id),
  check (status = 'draft' or (number is not null and submitted_at is not null and department_id is not null))
);
create index requests_status_idx on public.requests (org_id, status, submitted_at);
create index requests_requester_idx on public.requests (org_id, requester_id);
create index requests_department_idx on public.requests (org_id, department_id, status);
create trigger touch_updated_at before update on public.requests
  for each row execute function app.touch_updated_at();

create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  request_id uuid not null,
  position smallint not null check (position between 1 and 50),
  description text not null check (char_length(description) <= 200),
  quantity numeric(12, 3) not null check (quantity between 0 and 100000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 100000000000),
  line_total_minor bigint not null generated always as (round(quantity * unit_price_minor)::bigint) stored,
  approved_minor bigint check (approved_minor >= 0),
  unique (request_id, position),
  foreign key (org_id, request_id) references public.requests (org_id, id) on delete cascade
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  request_id uuid not null,
  field_key text,
  kind text not null default 'other' check (kind in ('vendor_receipt', 'purchase_photo', 'transfer_proof', 'acknowledgement', 'other')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 160),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  size integer not null check (size between 1 and 10485760),
  sha256 text,
  uploaded_by uuid not null,
  ready_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, request_id) references public.requests (org_id, id) on delete cascade,
  foreign key (org_id, uploaded_by) references public.memberships (org_id, id)
);
create index attachments_request_idx on public.attachments (request_id);
create index attachments_sha_idx on public.attachments (org_id, sha256);

-- Private bucket with no client policies: files move only through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.approval_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  request_id uuid not null,
  workflow_version_id uuid,
  run_no smallint not null,
  status text not null default 'active' check (status in ('active', 'approved', 'returned', 'rejected', 'cancelled')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (request_id, run_no),
  foreign key (org_id, request_id) references public.requests (org_id, id),
  foreign key (org_id, workflow_version_id) references public.workflow_versions (org_id, id)
);
create unique index approval_runs_one_active on public.approval_runs (request_id) where status = 'active';

create table public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  run_id uuid not null,
  position smallint not null,
  name text not null,
  approver_type text not null check (approver_type in ('category_approvers', 'role', 'member')),
  role_id uuid,
  membership_id uuid,
  required_approvals smallint not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'approved', 'returned', 'rejected', 'cancelled')),
  activated_at timestamptz,
  decided_at timestamptz,
  unique (org_id, id),
  unique (run_id, position),
  foreign key (org_id, run_id) references public.approval_runs (org_id, id),
  foreign key (org_id, role_id) references public.roles (org_id, id),
  foreign key (org_id, membership_id) references public.memberships (org_id, id)
);
create index approval_steps_active_idx on public.approval_steps (org_id) where status = 'active';

create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  step_id uuid not null,
  membership_id uuid not null,
  action text not null check (action in ('approve', 'return', 'reject')),
  comment text check (char_length(comment) <= 1000),
  approved_minor bigint,
  created_at timestamptz not null default now(),
  unique (step_id, membership_id),
  foreign key (org_id, step_id) references public.approval_steps (org_id, id),
  foreign key (org_id, membership_id) references public.memberships (org_id, id),
  check (action = 'approve' or char_length(btrim(comment)) >= 5)
);

-- What people see as the timeline, including comments.
create table public.request_events (
  id bigint generated always as identity primary key,
  org_id uuid not null,
  request_id uuid not null,
  actor_id uuid not null,
  type text not null check (type in ('submitted', 'approved', 'returned', 'rejected', 'withdrawn', 'reassigned', 'commented')),
  step_name text,
  body text check (char_length(body) <= 2000),
  amount_minor bigint,
  created_at timestamptz not null default now(),
  foreign key (org_id, request_id) references public.requests (org_id, id),
  foreign key (org_id, actor_id) references public.memberships (org_id, id)
);
create index request_events_request_idx on public.request_events (request_id, id);

create trigger approval_actions_append_only before update or delete on public.approval_actions
  for each row execute function app.block_mutation();
create trigger request_events_append_only before update or delete on public.request_events
  for each row execute function app.block_mutation();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  membership_id uuid not null,
  type text not null,
  request_id uuid,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (org_id, membership_id) references public.memberships (org_id, id),
  foreign key (org_id, request_id) references public.requests (org_id, id)
);
create index notifications_member_idx on public.notifications (membership_id, created_at desc);
create index notifications_unread_idx on public.notifications (membership_id) where read_at is null;

do $$
declare t text;
begin
  foreach t in array array['requests', 'request_items', 'attachments', 'approval_runs', 'approval_steps',
    'approval_actions', 'request_events', 'notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Helpers -------------------------------------------------------------------

create function app.member_name(p_membership uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(btrim(p.full_name), ''), 'Unnamed member')
  from public.memberships m left join public.profiles p on p.user_id = m.user_id where m.id = p_membership
$$;

create function app.assigned_to_category(p_org uuid, p_category uuid, p_department uuid, p_membership uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.category_approvers a
    where a.org_id = p_org and a.category_id = p_category
      and (a.department_id is null or a.department_id = p_department)
      and (a.membership_id = p_membership or exists (
        select 1 from app.current_grants(p_org) g where g.membership_id = p_membership and g.role_id = a.role_id
          and (g.department_id is null or g.department_id = p_department))))
$$;

create function app.has_category_perm(p_org uuid, p_key text, p_category uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app.current_grants(p_org) g
    join public.role_permissions rp on rp.role_id = g.role_id and rp.permission_key = p_key and rp.scope = 'category'
    where g.membership_id = app.membership_id(p_org)
  ) and app.assigned_to_category(p_org, p_category, p_department, app.membership_id(p_org))
$$;

-- People who may decide a step now. Calculated each time, so joiners and leavers are always respected.
create function app.run_step_approvers(p_step uuid, p_member uuid default null) returns setof uuid
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
    where rp.scope in ('org', 'category') or g.department_id = s.department_id
  )
  select h.membership_id from holders h cross join s
  where h.membership_id <> s.requester_id and case s.approver_type
    when 'member' then h.membership_id = s.membership_id
    when 'role' then exists (select 1 from grants g where g.membership_id = h.membership_id and g.role_id = s.role_id
      and (g.department_id is null or g.department_id = s.department_id))
    else exists (select 1 from app.category_approvers_for(s.org_id, s.category_id, s.department_id) c
      where c = h.membership_id) end
$$;

create function app.can_act(p_step uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_member is not null and exists (select 1 from app.run_step_approvers(p_step, p_member))
    and not exists (select 1 from public.approval_actions a where a.step_id = p_step and a.membership_id = p_member)
$$;

create function app.can_view_request(p public.requests) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p.org_id);
begin
  if v_me = p.requester_id then return true; end if;
  if p.status = 'draft' then return false; end if;
  if app.has_support_access(p.org_id) then return true; end if;
  if v_me is null then return false; end if;
  return app.has_perm(p.org_id, 'requests.view', p.department_id)
    or app.has_category_perm(p.org_id, 'requests.view', p.category_id, p.department_id)
    or exists (
      select 1 from public.approval_runs ru join public.approval_steps st on st.run_id = ru.id
      where ru.request_id = p.id and (
        exists (select 1 from public.approval_actions a where a.step_id = st.id and a.membership_id = v_me)
        or (st.status = 'active' and app.can_act(st.id, v_me))));
end $$;

create function app.get_visible_request(p_id uuid) returns public.requests
language plpgsql stable security definer set search_path = '' as $$
declare v public.requests;
begin
  select * into v from public.requests where id = p_id;
  if v.id is null or not app.can_view_request(v) then raise exception 'not_found' using errcode = 'P0002'; end if;
  return v;
end $$;

-- Locks the caller's own request and checks they are editing the version they loaded.
create function app.lock_own_request(p_id uuid, p_lock integer) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare v public.requests;
begin
  select * into v from public.requests where id = p_id for update;
  if v.id is null or v.requester_id is distinct from app.membership_id(v.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.lock_version is distinct from p_lock then raise exception 'stale_request' using errcode = '22023'; end if;
  return v;
end $$;

create function app.notify(p_org uuid, p_members uuid[], p_type text, p_request uuid, p_payload jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (org_id, membership_id, type, request_id, payload)
  select p_org, m.id, p_type, p_request, p_payload
  from public.memberships m
  where m.org_id = p_org and m.status = 'active' and m.id = any (p_members)
    and m.id is distinct from app.membership_id(p_org)
$$;

create function app.request_payload(p public.requests) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('number', p.number, 'title', p.title, 'requester', app.member_name(p.requester_id),
    'actor', app.member_name(app.membership_id(p.org_id)))
$$;

-- Drafts --------------------------------------------------------------------

create function public.requestable_categories(p_org uuid)
returns table (id uuid, name text, departments uuid[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_perm(p_org, 'requests.create', null, app.membership_id(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Each category with the caller's departments that may use it.
  return query
  select c.id, c.name, array_agg(dm.department_id)
  from public.categories c
  join public.department_members dm on dm.org_id = p_org and dm.membership_id = app.membership_id(p_org)
  join public.departments d on d.id = dm.department_id and d.archived_at is null
  where c.org_id = p_org and c.archived_at is null and c.applies_to <> 'expense'
    and (not exists (select 1 from public.category_departments x where x.category_id = c.id)
      or exists (select 1 from public.category_departments x where x.category_id = c.id and x.department_id = dm.department_id))
  group by c.id, c.name order by c.name;
end $$;

-- p_items: ordered [{description, quantity, unit_price_minor}]. Drafts may be incomplete.
create function public.save_request(
  p_org uuid, p_id uuid, p_category uuid, p_department uuid, p_title text, p_purpose text,
  p_needed_by date, p_form jsonb, p_items jsonb, p_lock integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := app.membership_id(p_org);
  v public.requests; v_id uuid := p_id; v_version uuid; v_fields jsonb; v_form jsonb; v_total numeric;
begin
  if not app.has_perm(p_org, 'requests.create', null, v_me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.requestable_categories(p_org) c
    where c.id = p_category and (p_department is null or p_department = any (c.departments))) then
    raise exception 'category_unavailable' using errcode = '22023';
  end if;
  if jsonb_typeof(p_form) is distinct from 'object' or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  select t.current_version_id, tv.fields into v_version, v_fields
    from public.categories c left join public.templates t on t.id = c.template_id
    left join public.template_versions tv on tv.id = t.current_version_id where c.id = p_category;
  -- Keep only answers to questions that still exist.
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_form
    from jsonb_each(p_form) e
    where exists (select 1 from jsonb_array_elements(coalesce(v_fields, '[]'::jsonb)) f
      where f ->> 'key' = e.key and f ->> 'type' <> 'file');

  if p_id is null then
    insert into public.requests (org_id, requester_id, category_id) values (p_org, v_me, p_category) returning id into v_id;
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
  update public.requests set category_id = p_category, department_id = p_department, template_version_id = v_version,
    title = btrim(coalesce(p_title, '')), purpose = btrim(coalesce(p_purpose, '')), needed_by = p_needed_by,
    form_data = v_form, total_minor = v_total::bigint, approved_minor = null,
    lock_version = case when p_id is null then 1 else lock_version + 1 end
    where id = v_id returning * into v;
  return jsonb_build_object('id', v_id, 'version', v.lock_version);
end $$;

create function public.delete_draft(p_id uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_paths text[];
begin
  select * into v from public.requests where id = p_id for update;
  if v.id is null or v.requester_id is distinct from app.membership_id(v.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.status <> 'draft' then raise exception 'request_locked' using errcode = '22023'; end if;
  select coalesce(array_agg(storage_path), '{}') into v_paths from public.attachments where request_id = p_id;
  delete from public.requests where id = p_id;
  return v_paths;
end $$;

-- Attachments ---------------------------------------------------------------

create function public.start_attachment(p_request uuid, p_field text, p_name text, p_mime text, p_size integer)
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
  if p_field is not null and not exists (
    select 1 from public.template_versions tv, jsonb_array_elements(tv.fields) f
    where tv.id = v.template_version_id and f ->> 'key' = p_field and f ->> 'type' = 'file') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_path := v.org_id || '/requests/' || p_request || '/' || v_id;
  insert into public.attachments (id, org_id, request_id, field_key, storage_path, file_name, mime, size, uploaded_by)
    values (v_id, v.org_id, p_request, p_field, v_path, right(btrim(p_name), 160), p_mime, p_size, v.requester_id);
  return jsonb_build_object('id', v_id, 'path', v_path);
end $$;

-- The caller's own unfinished upload, so the server can inspect the stored file.
create function public.get_pending_attachment(p_id uuid) returns table (storage_path text, mime text)
language sql stable security definer set search_path = '' as $$
  select a.storage_path, a.mime from public.attachments a join public.requests r on r.id = a.request_id
  where a.id = p_id and a.ready_at is null and r.requester_id = app.membership_id(r.org_id)
$$;

create function public.finish_attachment(p_id uuid, p_size integer, p_sha256 text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.attachments a set ready_at = now(), size = p_size, sha256 = p_sha256
    from public.requests r
    where a.id = p_id and r.id = a.request_id and a.ready_at is null and r.status in ('draft', 'returned');
  if not found then raise exception 'request_locked' using errcode = '22023'; end if;
end $$;

create function public.discard_attachment(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.attachments where id = p_id and ready_at is null
$$;

-- Files an approver may have seen are hidden, not destroyed; the path is returned only when it can be deleted.
create function public.remove_attachment(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v public.requests; a public.attachments;
begin
  select * into a from public.attachments where id = p_id and removed_at is null;
  select * into v from public.requests where id = a.request_id for update;
  if v.id is null or v.requester_id is distinct from app.membership_id(v.org_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.status not in ('draft', 'returned') then raise exception 'request_locked' using errcode = '22023'; end if;
  if v.submitted_at is null then
    delete from public.attachments where id = p_id;
    return a.storage_path;
  end if;
  update public.attachments set removed_at = now() where id = p_id;
  return null;
end $$;

create function public.get_attachment(p_id uuid) returns table (storage_path text, file_name text, mime text)
language plpgsql stable security definer set search_path = '' as $$
declare a public.attachments;
begin
  select * into a from public.attachments x where x.id = p_id and x.ready_at is not null and x.removed_at is null;
  if a.id is null then return; end if;
  perform app.get_visible_request(a.request_id);
  return query select a.storage_path, a.file_name, a.mime;
end $$;

-- Submitting ----------------------------------------------------------------

create function app.assert_form(p_fields jsonb, p_form jsonb, p_request uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare f jsonb; v jsonb; v_text text; v_ok boolean; v_blank boolean;
begin
  for f in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    v := p_form -> (f ->> 'key');
    v_text := v #>> '{}';
    if f ->> 'type' = 'file' then
      v_blank := not exists (select 1 from public.attachments a where a.request_id = p_request
        and a.field_key = f ->> 'key' and a.ready_at is not null and a.removed_at is null);
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

-- The steps that apply to a category and amount.
create function app.steps_for(p_category uuid, p_total bigint)
returns table (n bigint, name text, approver_type text, role_id uuid, membership_id uuid, required_approvals smallint)
language sql stable security definer set search_path = '' as $$
  select row_number() over (order by s.position), s.name, s.approver_type, s.role_id, s.membership_id, s.required_approvals
  from public.categories c join public.workflows w on w.id = c.workflow_id
  join public.workflow_steps s on s.workflow_version_id = w.current_version_id
  where c.id = p_category and (s.min_amount_minor is null or p_total >= s.min_amount_minor)
  union all
  select 1, 'Approval', 'category_approvers', null, null, 1::smallint
  from public.categories c where c.id = p_category and c.workflow_id is null
$$;

create function app.step_label(p_type text, p_role uuid, p_member uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case p_type when 'role' then (select name from public.roles where id = p_role)
    when 'member' then app.member_name(p_member) else 'Category approvers' end
$$;

create function app.activate_step(p_step uuid, p public.requests) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.approval_steps set status = 'active', activated_at = now() where id = p_step;
  perform app.notify(p.org_id, array(select app.run_step_approvers(p_step)), 'approval_needed', p.id, app.request_payload(p));
end $$;

create function public.submit_request(p_id uuid, p_lock integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_me uuid; v_run uuid; v_current uuid; v_fields jsonb; v_first uuid; s record; v_count integer;
begin
  v := app.lock_own_request(p_id, p_lock);
  v_me := v.requester_id;
  if not app.has_perm(v.org_id, 'requests.create', null, v_me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v.status not in ('draft', 'returned') then raise exception 'request_locked' using errcode = '22023'; end if;
  -- Configuration cannot change underneath the steps being copied.
  perform app.lock_org(v.org_id);
  if v.department_id is null then raise exception 'department_missing' using errcode = '22023'; end if;
  if not exists (select 1 from public.requestable_categories(v.org_id) c
    where c.id = v.category_id and v.department_id = any (c.departments)) then
    raise exception 'category_unavailable' using errcode = '22023';
  end if;
  if char_length(v.title) < 3 or char_length(v.purpose) < 5 then
    raise exception 'request_incomplete' using errcode = '22023';
  end if;
  if exists (select 1 from public.request_items i where i.request_id = p_id
    and (char_length(i.description) < 2 or i.quantity <= 0 or i.unit_price_minor <= 0)) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  select t.current_version_id, tv.fields into v_current, v_fields
    from public.categories c left join public.templates t on t.id = c.template_id
    left join public.template_versions tv on tv.id = t.current_version_id where c.id = v.category_id;
  if v_current is distinct from v.template_version_id then
    raise exception 'template_changed' using errcode = '22023';
  end if;
  perform app.assert_form(v_fields, v.form_data, p_id);

  update public.requests set status = 'pending', number = coalesce(number, app.next_number(org_id, 'request')),
    submitted_at = now(), decided_at = null, approved_minor = null, lock_version = lock_version + 1
    where id = p_id returning * into v;
  update public.request_items set approved_minor = null where request_id = p_id;
  insert into public.approval_runs (org_id, request_id, workflow_version_id, run_no, snapshot)
  select v.org_id, p_id, (select w.current_version_id from public.categories c join public.workflows w on w.id = c.workflow_id
      where c.id = v.category_id),
    (select count(*) + 1 from public.approval_runs where request_id = p_id),
    jsonb_build_object('title', v.title, 'purpose', v.purpose, 'department_id', v.department_id,
      'category_id', v.category_id, 'template_version_id', v.template_version_id, 'needed_by', v.needed_by,
      'form_data', v.form_data, 'total_minor', v.total_minor,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('description', i.description, 'quantity', i.quantity,
        'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor) order by i.position), '[]'::jsonb)
        from public.request_items i where i.request_id = p_id),
      'attachments', (select coalesce(jsonb_agg(a.id order by a.created_at), '[]'::jsonb) from public.attachments a
        where a.request_id = p_id and a.ready_at is not null and a.removed_at is null))
  returning id into v_run;
  insert into public.approval_steps (org_id, run_id, position, name, approver_type, role_id, membership_id, required_approvals)
    select v.org_id, v_run, x.n, x.name, x.approver_type, x.role_id, x.membership_id, x.required_approvals
    from app.steps_for(v.category_id, v.total_minor) x;
  -- Fail now rather than leave a request nobody can decide.
  for s in select * from public.approval_steps where run_id = v_run order by position loop
    select count(*) into v_count from app.run_step_approvers(s.id);
    if v_count < s.required_approvals then raise exception 'not_enough_approvers' using errcode = '22023'; end if;
    v_first := coalesce(v_first, s.id);
  end loop;
  if v_first is null then raise exception 'not_enough_approvers' using errcode = '22023'; end if;
  insert into public.request_events (org_id, request_id, actor_id, type, amount_minor)
    values (v.org_id, p_id, v_me, 'submitted', v.total_minor);
  perform app.activate_step(v_first, v);
  perform app.write_audit(v.org_id, 'request.submitted', 'request', p_id, null,
    jsonb_build_object('number', v.number, 'total_minor', v.total_minor));
  return jsonb_build_object('id', p_id, 'version', v.lock_version);
end $$;

create function public.withdraw_request(p_id uuid, p_lock integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests;
begin
  v := app.lock_own_request(p_id, p_lock);
  if v.status not in ('pending', 'returned') then raise exception 'request_locked' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  update public.requests set status = 'cancelled', closed_at = now(), lock_version = lock_version + 1 where id = p_id;
  update public.approval_steps st set status = 'cancelled' from public.approval_runs ru
    where ru.request_id = p_id and ru.status = 'active' and st.run_id = ru.id and st.status in ('active', 'waiting');
  update public.approval_runs set status = 'cancelled' where request_id = p_id and status = 'active';
  insert into public.request_events (org_id, request_id, actor_id, type, body)
    values (v.org_id, p_id, v.requester_id, 'withdrawn', btrim(p_reason));
  perform app.write_audit(v.org_id, 'request.withdrawn', 'request', p_id, null, jsonb_build_object('number', v.number), btrim(p_reason));
end $$;

-- Deciding ------------------------------------------------------------------

-- p_items: [{id, approved_minor}] for reduced lines only; amounts can fall but never rise.
create function public.decide_request(p_step uuid, p_lock integer, p_action text, p_comment text, p_items jsonb default '[]')
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
        -- Nothing to pay, so nothing more to do.
        update public.requests set decided_at = now(), status = case when total_minor = 0 then 'closed' else 'approved' end,
          closed_at = case when total_minor = 0 then now() end where id = v.id;
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

-- For when the people a step depends on are away or have left.
create function public.reassign_step(p_step uuid, p_membership uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests; st public.approval_steps;
begin
  select r.* into v from public.requests r
    join public.approval_runs x on x.request_id = r.id join public.approval_steps s on s.run_id = x.id
    where s.id = p_step for update of r;
  if v.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(v.org_id, 'config.manage');
  select * into st from public.approval_steps where id = p_step;
  if st.status <> 'active' then raise exception 'stale_request' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  if exists (select 1 from public.approval_actions where step_id = p_step and membership_id = p_membership) then
    raise exception 'cannot_reassign' using errcode = '22023';
  end if;
  update public.approval_steps set approver_type = 'member', membership_id = p_membership, role_id = null,
    -- Approvals already given still count.
    required_approvals = 1 + (select count(*) from public.approval_actions where step_id = p_step and action = 'approve')
    where id = p_step;
  if not exists (select 1 from app.run_step_approvers(p_step, p_membership)) then
    raise exception 'cannot_reassign' using errcode = '22023';
  end if;
  update public.requests set lock_version = lock_version + 1 where id = v.id;
  insert into public.request_events (org_id, request_id, actor_id, type, step_name, body)
    values (v.org_id, v.id, app.membership_id(v.org_id), 'reassigned', st.name,
      'To ' || app.member_name(p_membership) || ': ' || btrim(p_reason));
  perform app.notify(v.org_id, array[p_membership], 'approval_needed', v.id, app.request_payload(v));
  perform app.write_audit(v.org_id, 'request.reassigned', 'request', v.id,
    jsonb_build_object('approver_type', st.approver_type, 'role_id', st.role_id, 'membership_id', st.membership_id),
    jsonb_build_object('membership_id', p_membership), btrim(p_reason));
end $$;

create function public.comment_on_request(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.requests; v_me uuid;
begin
  v := app.get_visible_request(p_id);
  v_me := app.membership_id(v.org_id);
  -- Support access is read-only.
  if v_me is null or v.status = 'draft' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'comment_required' using errcode = '22023';
  end if;
  insert into public.request_events (org_id, request_id, actor_id, type, body) values (v.org_id, p_id, v_me, 'commented', btrim(p_body));
  perform app.notify(v.org_id, array(
    select v.requester_id union select e.actor_id from public.request_events e where e.request_id = p_id
  ), 'request_comment', p_id, app.request_payload(v));
end $$;

-- Reading -------------------------------------------------------------------

create function public.get_request(p_id uuid) returns jsonb
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
        from app.run_step_approvers(st.id) x where not exists (
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
    'fields', coalesce((select fields from public.template_versions where id = v.template_version_id), '[]'::jsonb),
    'form_data', v.form_data,
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

-- The steps a draft would go through if submitted now.
create function public.preview_steps(p_category uuid, p_total bigint)
returns table (name text, who text, required smallint)
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.categories where id = p_category;
  if v_org is null or not app.is_member(v_org) then raise exception 'not_found' using errcode = 'P0002'; end if;
  return query select s.name, app.step_label(s.approver_type, s.role_id, s.membership_id), s.required_approvals
    from app.steps_for(p_category, coalesce(p_total, 0)) s order by s.n;
end $$;

-- Search needs every word; plain matching, so % and _ are not special.
create function app.matches(p_text text, p_search text) returns boolean
language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from regexp_split_to_table(lower(btrim(left(coalesce(p_search, ''), 100))), '\s+') w
    where w <> '' and strpos(lower(p_text), w) = 0)
$$;

-- p_view: mine, all (everything the caller may see except others' drafts) or inbox (waiting for the caller).
create function public.list_requests(
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
    select r.*, c.name as category_name, coalesce(d.name, '') as department_name, app.member_name(r.requester_id) as who, st.activated_at
    from public.requests r
    join public.categories c on c.id = r.category_id
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

-- Counts for the navigation and dashboard.
create function public.my_work(p_org uuid)
returns table (approvals bigint, unread bigint, open_requests bigint, returned bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_me uuid := app.membership_id(p_org);
begin
  if v_me is null then return query select 0::bigint, 0::bigint, 0::bigint, 0::bigint; return; end if;
  return query select
    case when exists (select 1 from app.permission_holders(p_org, 'requests.approve') h where h = v_me) then (
      select count(*) from public.approval_steps st where st.org_id = p_org and st.status = 'active' and app.can_act(st.id, v_me))
    else 0 end,
    (select count(*) from public.notifications n where n.membership_id = v_me and n.read_at is null),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me
      and r.status in ('pending', 'approved', 'part_paid', 'paid', 'received')),
    (select count(*) from public.requests r where r.org_id = p_org and r.requester_id = v_me and r.status = 'returned');
end $$;

create function public.list_notifications(p_org uuid, p_unread boolean default false, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, type text, request_id uuid, payload jsonb, read_at timestamptz, created_at timestamptz, total bigint)
language sql stable security definer set search_path = '' as $$
  select n.id, n.type, n.request_id, n.payload, n.read_at, n.created_at, count(*) over ()
  from public.notifications n
  where n.org_id = p_org and n.membership_id = app.membership_id(p_org)
    and (not coalesce(p_unread, false) or n.read_at is null)
  order by n.created_at desc, n.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
$$;

create function public.mark_notifications_read(p_org uuid, p_request uuid default null) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where org_id = p_org and membership_id = app.membership_id(p_org) and read_at is null
    and (p_request is null or request_id = p_request)
$$;

revoke execute on all functions in schema app from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'requestable_categories(uuid)', 'save_request(uuid, uuid, uuid, uuid, text, text, date, jsonb, jsonb, integer)',
    'delete_draft(uuid)', 'start_attachment(uuid, text, text, text, integer)', 'get_pending_attachment(uuid)',
    'remove_attachment(uuid)', 'get_attachment(uuid)', 'submit_request(uuid, integer)',
    'withdraw_request(uuid, integer, text)', 'decide_request(uuid, integer, text, text, jsonb)',
    'reassign_step(uuid, uuid, text)', 'comment_on_request(uuid, text)', 'get_request(uuid)',
    'preview_steps(uuid, bigint)',
    'list_requests(uuid, text, text, text, uuid, uuid, text, boolean, integer, integer)', 'my_work(uuid)',
    'list_notifications(uuid, boolean, integer, integer)', 'mark_notifications_read(uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- The server calls these after inspecting the stored file itself.
  foreach f in array array['finish_attachment(uuid, integer, text)', 'discard_attachment(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
