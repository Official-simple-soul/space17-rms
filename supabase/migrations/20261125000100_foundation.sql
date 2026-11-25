-- Private helpers, identity, organisations and access control.

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- Deny by default: every table and function must be granted explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;

create function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Identity ------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Organisations -------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48),
  logo_path text,
  currency char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Lagos',
  fiscal_year_start_month smallint not null default 1
    check (fiscal_year_start_month between 1 and 12),
  status text not null default 'setup' check (status in ('setup', 'active', 'suspended')),
  plan text not null default 'standard',
  limits jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  code text not null check (code ~ '^[A-Z0-9]{2,10}$'),
  parent_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, code),
  foreign key (org_id, parent_id) references public.departments (org_id, id),
  check (parent_id is null or parent_id <> id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  user_id uuid not null references auth.users (id),
  staff_no text,
  job_title text,
  primary_department_id uuid,
  status text not null default 'active' check (status in ('active', 'suspended', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id),
  unique (org_id, id),
  foreign key (org_id, primary_department_id) references public.departments (org_id, id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Access --------------------------------------------------------------------

create table public.permissions (
  key text primary key,
  description text not null,
  allowed_scopes text[] not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  system_key text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, system_key)
);

create table public.role_permissions (
  org_id uuid not null,
  role_id uuid not null,
  permission_key text not null references public.permissions (key),
  scope text not null check (scope in ('own', 'category', 'department', 'org')),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key, scope),
  foreign key (org_id, role_id) references public.roles (org_id, id) on delete cascade
);

create table public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null,
  department_id uuid,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid,
  created_at timestamptz not null default now(),
  unique nulls not distinct (membership_id, role_id, department_id),
  foreign key (org_id, membership_id) references public.memberships (org_id, id),
  foreign key (org_id, role_id) references public.roles (org_id, id),
  foreign key (org_id, department_id) references public.departments (org_id, id),
  foreign key (org_id, granted_by) references public.memberships (org_id, id),
  check (valid_until is null or valid_until > valid_from)
);
create index membership_roles_member_idx on public.membership_roles (membership_id);

-- Platform ------------------------------------------------------------------

create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_org_id uuid references public.organisations (id),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index org_invites_one_open on public.org_invites (email)
  where accepted_at is null and revoked_at is null;

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  org_name text not null check (char_length(btrim(org_name)) between 2 and 120),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  message text check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'invited', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index access_requests_one_pending on public.access_requests (email)
  where status = 'pending';

create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  admin_user_id uuid not null references auth.users (id),
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at and expires_at <= starts_at + interval '2 hours')
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations (id),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_org_idx on public.audit_logs (org_id, created_at desc);

create function app.block_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit records are append-only' using errcode = '42501';
end $$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function app.block_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function app.block_mutation();

do $$
declare t text;
begin
  foreach t in array array['profiles', 'organisations', 'departments', 'memberships', 'roles', 'access_requests']
  loop
    execute format(
      'create trigger touch_updated_at before update on public.%I for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

-- Permission catalogue ------------------------------------------------------

insert into public.permissions (key, description, allowed_scopes) values
  ('org.manage', 'Manage organisation details', '{org}'),
  ('members.manage', 'Invite and manage members', '{org}'),
  ('roles.manage', 'Manage roles and permissions', '{org}'),
  ('config.manage', 'Manage categories, templates and workflows', '{org}'),
  ('requests.create', 'Create requests', '{own}'),
  ('requests.view', 'View requests', '{own,category,department,org}'),
  ('requests.approve', 'Approve requests', '{category,department,org}'),
  ('payments.record', 'Record payments', '{org}'),
  ('payments.void', 'Void payments', '{org}'),
  ('expenses.create', 'Add expenses', '{own}'),
  ('expenses.view', 'View expenses', '{own,department,org}'),
  ('expenses.accept', 'Accept expenses into reports', '{department}'),
  ('reports.view', 'View reports', '{department,org}'),
  ('reports.submit', 'Submit reports', '{department}'),
  ('reports.review', 'Review and approve reports', '{org}'),
  ('receipts.issue', 'Issue internal receipts', '{org}'),
  ('receipts.void', 'Void internal receipts', '{org}'),
  ('periods.close', 'Close reporting periods', '{org}'),
  ('exports.create', 'Export data', '{department,org}'),
  ('audit.view', 'View the audit log', '{org}');

-- Profile creation ----------------------------------------------------------

create function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();
