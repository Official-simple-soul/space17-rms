-- Categories, versioned templates and workflows, document numbering and setup checks.

-- Templates -----------------------------------------------------------------

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  kind text not null check (kind in ('request', 'expense_report', 'narrative_report')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  current_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);
create unique index templates_name_key on public.templates (org_id, kind, lower(name)) where archived_at is null;

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  template_id uuid not null,
  version integer not null check (version > 0),
  fields jsonb not null,
  published_by uuid not null,
  published_at timestamptz not null default now(),
  unique (org_id, id),
  unique (template_id, id),
  unique (template_id, version),
  foreign key (org_id, template_id) references public.templates (org_id, id),
  foreign key (org_id, published_by) references public.memberships (org_id, id)
);
alter table public.templates add foreign key (id, current_version_id)
  references public.template_versions (template_id, id);

-- Workflows -----------------------------------------------------------------

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  subject text not null check (subject in ('request', 'report')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  current_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id)
);
create unique index workflows_name_key on public.workflows (org_id, subject, lower(name)) where archived_at is null;

create table public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  workflow_id uuid not null,
  version integer not null check (version > 0),
  published_by uuid not null,
  published_at timestamptz not null default now(),
  unique (org_id, id),
  unique (workflow_id, id),
  unique (workflow_id, version),
  foreign key (org_id, workflow_id) references public.workflows (org_id, id),
  foreign key (org_id, published_by) references public.memberships (org_id, id)
);
alter table public.workflows add foreign key (id, current_version_id)
  references public.workflow_versions (workflow_id, id);

create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  workflow_version_id uuid not null,
  position smallint not null check (position between 1 and 10),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  approver_type text not null check (approver_type in ('category_approvers', 'role', 'member')),
  role_id uuid,
  membership_id uuid,
  min_amount_minor bigint check (min_amount_minor > 0),
  required_approvals smallint not null default 1 check (required_approvals between 1 and 10),
  unique (workflow_version_id, position),
  foreign key (org_id, workflow_version_id) references public.workflow_versions (org_id, id),
  foreign key (org_id, role_id) references public.roles (org_id, id),
  foreign key (org_id, membership_id) references public.memberships (org_id, id),
  check ((role_id is not null) = (approver_type = 'role')),
  check ((membership_id is not null) = (approver_type = 'member')),
  check (approver_type <> 'member' or required_approvals = 1)
);

-- A published version never changes; publishing again adds another.
create function app.block_version_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'version_immutable' using errcode = '42501';
end $$;
create trigger template_versions_immutable before update or delete on public.template_versions
  for each row execute function app.block_version_change();
create trigger workflow_versions_immutable before update or delete on public.workflow_versions
  for each row execute function app.block_version_change();
create trigger workflow_steps_immutable before update or delete on public.workflow_steps
  for each row execute function app.block_version_change();

-- Categories ----------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  code text not null check (code ~ '^[A-Z0-9]{2,10}$'),
  applies_to text not null default 'both' check (applies_to in ('request', 'expense', 'both')),
  requires_accounting boolean not null default true,
  template_id uuid,
  workflow_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, template_id) references public.templates (org_id, id),
  foreign key (org_id, workflow_id) references public.workflows (org_id, id)
);
create unique index categories_code_key on public.categories (org_id, code) where archived_at is null;
create unique index categories_name_key on public.categories (org_id, lower(name)) where archived_at is null;

-- No rows means every department may use the category.
create table public.category_departments (
  org_id uuid not null,
  category_id uuid not null,
  department_id uuid not null,
  primary key (category_id, department_id),
  foreign key (org_id, category_id) references public.categories (org_id, id),
  foreign key (org_id, department_id) references public.departments (org_id, id)
);

create table public.category_approvers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  category_id uuid not null,
  membership_id uuid,
  role_id uuid,
  department_id uuid,
  unique nulls not distinct (category_id, membership_id, role_id, department_id),
  foreign key (org_id, category_id) references public.categories (org_id, id),
  foreign key (org_id, membership_id) references public.memberships (org_id, id),
  foreign key (org_id, role_id) references public.roles (org_id, id),
  foreign key (org_id, department_id) references public.departments (org_id, id),
  check (num_nonnulls(membership_id, role_id) = 1)
);

-- Numbering -----------------------------------------------------------------

create table public.number_sequences (
  org_id uuid not null references public.organisations (id),
  document_type text not null check (document_type in ('request', 'report', 'payment', 'internal_receipt')),
  prefix text not null check (prefix ~ '^[A-Z0-9]{2,8}$'),
  reset text not null default 'year' check (reset in ('never', 'year', 'month')),
  digits smallint not null default 4 check (digits between 3 and 8),
  updated_at timestamptz not null default now(),
  primary key (org_id, document_type),
  unique (org_id, prefix)
);

create table public.number_counters (
  org_id uuid not null,
  document_type text not null,
  period_key text not null,
  last_value bigint not null,
  primary key (org_id, document_type, period_key),
  foreign key (org_id, document_type) references public.number_sequences (org_id, document_type)
);

create function app.seed_numbering() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.number_sequences (org_id, document_type, prefix) values
    (new.id, 'request', 'REQ'), (new.id, 'report', 'RPT'),
    (new.id, 'payment', 'PAY'), (new.id, 'internal_receipt', 'CPR');
  return new;
end $$;
create trigger seed_numbering after insert on public.organisations
  for each row execute function app.seed_numbering();
insert into public.number_sequences (org_id, document_type, prefix)
  select o.id, v.kind, v.prefix from public.organisations o
  cross join (values ('request', 'REQ'), ('report', 'RPT'), ('payment', 'PAY'), ('internal_receipt', 'CPR')) v (kind, prefix);

-- Called only inside the transaction that creates the document, so a failure leaves no gap.
create function app.next_number(p_org uuid, p_type text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_seq public.number_sequences; v_now timestamp; v_key text; v_value bigint;
begin
  select * into v_seq from public.number_sequences where org_id = p_org and document_type = p_type for share;
  if v_seq.org_id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select now() at time zone o.timezone into v_now from public.organisations o where o.id = p_org;
  v_key := case v_seq.reset when 'year' then to_char(v_now, 'YYYY')
    when 'month' then to_char(v_now, 'YYYYMM') else '' end;
  insert into public.number_counters as c (org_id, document_type, period_key, last_value)
    values (p_org, p_type, v_key, 1)
  on conflict (org_id, document_type, period_key) do update set last_value = c.last_value + 1
  returning last_value into v_value;
  return concat_ws('-', v_seq.prefix, nullif(v_key, ''),
    lpad(v_value::text, greatest(v_seq.digits, length(v_value::text)), '0'));
end $$;

-- Access --------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['templates', 'template_versions', 'workflows', 'workflow_versions', 'workflow_steps',
    'categories', 'category_departments', 'category_approvers', 'number_sequences', 'number_counters']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    if t <> 'number_counters' then
      execute format('grant select on public.%I to authenticated', t);
      execute format('create policy %I on public.%I for select to authenticated
        using (app.is_member(org_id) or app.has_support_access(org_id))', t || '_read', t);
    end if;
  end loop;
  foreach t in array array['templates', 'workflows', 'categories', 'number_sequences'] loop
    execute format('create trigger touch_updated_at before update on public.%I
      for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

-- Keep configuration valid when people, roles and departments change ----------

create function app.guard_department_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.categories c where c.org_id = new.org_id and c.archived_at is null and (
      exists (select 1 from public.category_departments x where x.category_id = c.id and x.department_id = new.id)
      or exists (select 1 from public.category_approvers x where x.category_id = c.id and x.department_id = new.id))
  ) then
    raise exception 'department_in_use' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger guard_archive before update of archived_at on public.departments
  for each row when (old.archived_at is null and new.archived_at is not null)
  execute function app.guard_department_archive();

create function app.guard_role_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.category_approvers x join public.categories c on c.id = x.category_id and c.archived_at is null
    where x.role_id = new.id
  ) or exists (
    select 1 from public.workflows w join public.workflow_steps s on s.workflow_version_id = w.current_version_id
    where w.archived_at is null and s.role_id = new.id
  ) then
    raise exception 'role_in_use' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger guard_archive before update of archived_at on public.roles
  for each row when (old.archived_at is null and new.archived_at is not null)
  execute function app.guard_role_archive();

create function app.remove_leaver_approvals() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.category_approvers where org_id = new.org_id and membership_id = new.id;
  return new;
end $$;
create trigger remove_leaver_approvals after update of status on public.memberships
  for each row when (new.status = 'left') execute function app.remove_leaver_approvals();

-- Who can approve -----------------------------------------------------------

create function app.current_grants(p_org uuid)
returns table (membership_id uuid, role_id uuid, department_id uuid)
language sql stable security definer set search_path = '' as $$
  select mr.membership_id, mr.role_id, mr.department_id
  from public.membership_roles mr
  join public.memberships m on m.id = mr.membership_id and m.status = 'active'
  join public.roles r on r.id = mr.role_id and r.archived_at is null
  where mr.org_id = p_org and mr.valid_from <= now() and (mr.valid_until is null or mr.valid_until > now())
$$;

create function app.permission_holders(p_org uuid, p_key text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct g.membership_id from app.current_grants(p_org) g
  join public.role_permissions rp on rp.role_id = g.role_id and rp.permission_key = p_key
$$;

-- Organisation and department permission cover every category; category permission needs an assignment.
create function app.category_approvers_for(p_org uuid, p_category uuid, p_department uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with grants as materialized (select * from app.current_grants(p_org))
  select distinct g.membership_id
  from grants g
  join public.role_permissions rp on rp.role_id = g.role_id and rp.permission_key = 'requests.approve'
  where (rp.scope = 'org' and g.department_id is null)
    or (rp.scope = 'department' and g.department_id = p_department)
    or (rp.scope = 'category' and exists (
      select 1 from public.category_approvers a
      where a.org_id = p_org and a.category_id = p_category
        and (a.department_id is null or a.department_id = p_department)
        and (a.membership_id = g.membership_id or exists (
          select 1 from grants held where held.membership_id = g.membership_id and held.role_id = a.role_id
            and (held.department_id is null or held.department_id = p_department)))))
$$;

create function app.step_approvers(p_org uuid, p_step uuid, p_key text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h from app.permission_holders(p_org, p_key) h
  join public.workflow_steps s on s.org_id = p_org and s.id = p_step
  where s.membership_id = h
    or exists (select 1 from app.current_grants(p_org) g where g.membership_id = h and g.role_id = s.role_id)
$$;

create function public.list_approvers(p_org uuid, p_key text)
returns table (id uuid, name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'config.manage', false);
  if p_key is null or p_key not in ('requests.approve', 'reports.review') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select m.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed member')
  from app.permission_holders(p_org, p_key) h
  join public.memberships m on m.id = h
  left join public.profiles p on p.user_id = m.user_id
  order by 2, 1;
end $$;

-- Saving templates and workflows ----------------------------------------------

create function app.assert_fields(p_fields jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare f jsonb; v_keys text[] := '{}'; v_options jsonb;
begin
  if jsonb_typeof(p_fields) is distinct from 'array' or jsonb_array_length(p_fields) > 40 then
    raise exception 'invalid_fields' using errcode = '22023';
  end if;
  for f in select * from jsonb_array_elements(p_fields) loop
    if jsonb_typeof(f) <> 'object'
      or coalesce(f ->> 'key', '') !~ '^[a-z][a-z0-9_]{0,39}$' or f ->> 'key' = any (v_keys)
      or char_length(btrim(coalesce(f ->> 'label', ''))) not between 1 and 120
      or char_length(coalesce(f ->> 'help', '')) > 200
      or jsonb_typeof(f -> 'required') is distinct from 'boolean'
      or coalesce(f ->> 'type', '') not in
        ('short_text', 'long_text', 'number', 'money', 'date', 'dropdown', 'checkbox', 'file')
      or exists (select 1 from jsonb_object_keys(f) k where k not in ('key', 'label', 'help', 'type', 'required', 'options'))
    then
      raise exception 'invalid_fields' using errcode = '22023';
    end if;
    v_options := f -> 'options';
    if f ->> 'type' = 'dropdown' then
      if jsonb_typeof(v_options) is distinct from 'array' then
        raise exception 'invalid_fields' using errcode = '22023';
      end if;
      if jsonb_array_length(v_options) not between 2 and 50
        or exists (select 1 from jsonb_array_elements(v_options) o
          where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 80)
        or (select count(distinct o) from jsonb_array_elements(v_options) o) <> jsonb_array_length(v_options)
      then
        raise exception 'invalid_fields' using errcode = '22023';
      end if;
    elsif v_options is not null then
      raise exception 'invalid_fields' using errcode = '22023';
    end if;
    v_keys := v_keys || (f ->> 'key');
  end loop;
end $$;

-- p_expected is the version the editor loaded; a newer one means someone else published first.
create function public.save_template(
  p_org uuid, p_id uuid, p_kind text, p_name text, p_fields jsonb, p_expected integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_name text; v_version integer := 0; v_fields jsonb; v_new uuid;
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  perform app.assert_fields(p_fields);
  if p_id is null then
    insert into public.templates (org_id, kind, name) values (p_org, p_kind, btrim(p_name)) returning id into v_id;
  else
    select t.name, v.version, v.fields into v_name, v_version, v_fields
      from public.templates t join public.template_versions v on v.id = t.current_version_id
      where t.org_id = p_org and t.id = p_id and t.archived_at is null;
    if v_version is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if p_expected is distinct from v_version then raise exception 'stale_version' using errcode = '22023'; end if;
    update public.templates set name = btrim(p_name) where id = p_id;
  end if;
  if v_fields is distinct from p_fields then
    v_version := v_version + 1;
    insert into public.template_versions (org_id, template_id, version, fields, published_by)
      values (p_org, v_id, v_version, p_fields, app.membership_id(p_org)) returning id into v_new;
    update public.templates set current_version_id = v_new where id = v_id;
  end if;
  perform app.write_audit(p_org,
    case when p_id is null then 'template.created' when v_new is null then 'template.renamed' else 'template.published' end,
    'template', v_id, case when p_id is not null then jsonb_build_object('name', v_name) end,
    jsonb_build_object('name', btrim(p_name), 'version', v_version));
  return jsonb_build_object('id', v_id, 'version', v_version);
end $$;

create function public.archive_template(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if exists (select 1 from public.categories where org_id = p_org and template_id = p_id and archived_at is null) then
    raise exception 'template_in_use' using errcode = '22023';
  end if;
  update public.templates set archived_at = now() where org_id = p_org and id = p_id and archived_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(p_org, 'template.archived', 'template', p_id);
end $$;

create function app.workflow_steps_json(p_version uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'approver_type', approver_type, 'role_id', role_id,
    'membership_id', membership_id, 'min_amount_minor', min_amount_minor,
    'required_approvals', required_approvals) order by position), '[]'::jsonb)
  from public.workflow_steps where workflow_version_id = p_version
$$;

-- p_steps: ordered [{name, approver_type, role_id, membership_id, min_amount_minor, required_approvals}]
create function public.save_workflow(
  p_org uuid, p_id uuid, p_subject text, p_name text, p_steps jsonb, p_expected integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_subject text := p_subject; v_name text; v_version integer := 0; v_old uuid; v_new uuid;
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if p_id is not null then
    select w.subject, w.name, v.version, v.id into v_subject, v_name, v_version, v_old
      from public.workflows w join public.workflow_versions v on v.id = w.current_version_id
      where w.org_id = p_org and w.id = p_id and w.archived_at is null;
    if v_version is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if p_expected is distinct from v_version then raise exception 'stale_version' using errcode = '22023'; end if;
  end if;
  if jsonb_typeof(p_steps) is distinct from 'array' or jsonb_array_length(p_steps) not between 1 and 10 then
    raise exception 'invalid_steps' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_steps)
      as s (approver_type text, role_id uuid, membership_id uuid, required_approvals integer)
    where coalesce(s.approver_type, '') not in ('category_approvers', 'role', 'member')
      or (s.approver_type = 'category_approvers' and v_subject is distinct from 'request')
      or (s.approver_type = 'role' and not exists (
        select 1 from public.roles r where r.org_id = p_org and r.id = s.role_id and r.archived_at is null))
      or (s.approver_type = 'member' and not exists (
        select 1 from public.memberships m where m.org_id = p_org and m.id = s.membership_id and m.status = 'active'))
  ) then
    raise exception 'invalid_steps' using errcode = '22023';
  end if;
  -- Otherwise a small amount would need nobody's approval.
  if not exists (select 1 from jsonb_to_recordset(p_steps) as s (min_amount_minor bigint) where s.min_amount_minor is null) then
    raise exception 'step_always_needed' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.workflows (org_id, subject, name) values (p_org, p_subject, btrim(p_name)) returning id into v_id;
  else
    update public.workflows set name = btrim(p_name) where id = p_id;
  end if;
  if v_old is null or app.workflow_steps_json(v_old) is distinct from (
    select jsonb_agg(jsonb_build_object('name', btrim(s.name), 'approver_type', s.approver_type, 'role_id', s.role_id,
      'membership_id', s.membership_id, 'min_amount_minor', s.min_amount_minor,
      'required_approvals', coalesce(s.required_approvals, 1)) order by s.n)
    from rows from (jsonb_to_recordset(p_steps) as (name text, approver_type text, role_id uuid, membership_id uuid,
      min_amount_minor bigint, required_approvals smallint)) with ordinality
      as s (name, approver_type, role_id, membership_id, min_amount_minor, required_approvals, n)
  ) then
    v_version := v_version + 1;
    insert into public.workflow_versions (org_id, workflow_id, version, published_by)
      values (p_org, v_id, v_version, app.membership_id(p_org)) returning id into v_new;
    insert into public.workflow_steps (org_id, workflow_version_id, position, name, approver_type,
      role_id, membership_id, min_amount_minor, required_approvals)
    select p_org, v_new, s.n, btrim(s.name), s.approver_type, s.role_id, s.membership_id,
      s.min_amount_minor, coalesce(s.required_approvals, 1)
    from rows from (jsonb_to_recordset(p_steps) as (name text, approver_type text, role_id uuid, membership_id uuid,
      min_amount_minor bigint, required_approvals smallint)) with ordinality
      as s (name, approver_type, role_id, membership_id, min_amount_minor, required_approvals, n);
    update public.workflows set current_version_id = v_new where id = v_id;
  end if;
  perform app.write_audit(p_org,
    case when p_id is null then 'workflow.created' when v_new is null then 'workflow.renamed' else 'workflow.published' end,
    'workflow', v_id,
    case when p_id is not null then jsonb_build_object('name', v_name, 'steps', app.workflow_steps_json(v_old)) end,
    jsonb_build_object('name', btrim(p_name), 'version', v_version, 'steps', app.workflow_steps_json(coalesce(v_new, v_old))));
  return jsonb_build_object('id', v_id, 'version', v_version);
end $$;

create function public.archive_workflow(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if exists (select 1 from public.categories where org_id = p_org and workflow_id = p_id and archived_at is null) then
    raise exception 'workflow_in_use' using errcode = '22023';
  end if;
  update public.workflows set archived_at = now() where org_id = p_org and id = p_id and archived_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(p_org, 'workflow.archived', 'workflow', p_id);
end $$;

-- Categories ------------------------------------------------------------------

create function app.category_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', c.name, 'code', c.code, 'applies_to', c.applies_to,
    'requires_accounting', c.requires_accounting, 'template_id', c.template_id, 'workflow_id', c.workflow_id,
    'departments', (select coalesce(jsonb_agg(d.department_id order by d.department_id), '[]'::jsonb)
      from public.category_departments d where d.category_id = c.id),
    'approvers', (select coalesce(jsonb_agg(jsonb_build_object('membership_id', a.membership_id, 'role_id', a.role_id,
      'department_id', a.department_id) order by a.id), '[]'::jsonb)
      from public.category_approvers a where a.category_id = c.id))
  from public.categories c where c.id = p_id
$$;

-- p_approvers: [{membership_id | role_id, department_id}]
create function public.save_category(
  p_org uuid, p_id uuid, p_name text, p_code text, p_applies_to text, p_requires_accounting boolean,
  p_template uuid, p_workflow uuid, p_departments uuid[], p_approvers jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_before jsonb; v_expense boolean := p_applies_to = 'expense';
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if jsonb_typeof(p_approvers) is distinct from 'array' then
    raise exception 'invalid_approvers' using errcode = '22023';
  end if;
  -- Expense-only categories are never requested, so request settings do not apply.
  if v_expense then
    p_template := null; p_workflow := null; p_approvers := '[]'; p_requires_accounting := true;
  end if;
  if (p_template is not null and not exists (select 1 from public.templates
      where org_id = p_org and id = p_template and kind = 'request' and archived_at is null))
    or (p_workflow is not null and not exists (select 1 from public.workflows
      where org_id = p_org and id = p_workflow and subject = 'request' and archived_at is null))
    or exists (select 1 from unnest(coalesce(p_departments, '{}')) u where not exists (
      select 1 from public.departments d where d.org_id = p_org and d.id = u and d.archived_at is null))
    or exists (
      select 1 from jsonb_to_recordset(p_approvers) as a (membership_id uuid, role_id uuid, department_id uuid)
      where num_nonnulls(a.membership_id, a.role_id) <> 1
        or (a.membership_id is not null and not exists (select 1 from public.memberships m
          where m.org_id = p_org and m.id = a.membership_id and m.status = 'active'))
        or (a.role_id is not null and not exists (select 1 from public.roles r
          where r.org_id = p_org and r.id = a.role_id and r.archived_at is null))
        or (a.department_id is not null and not exists (select 1 from public.departments d
          where d.org_id = p_org and d.id = a.department_id and d.archived_at is null)))
  then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_id is null then
    insert into public.categories (org_id, name, code, applies_to, requires_accounting, template_id, workflow_id)
      values (p_org, btrim(p_name), upper(btrim(p_code)), p_applies_to, p_requires_accounting, p_template, p_workflow)
      returning id into v_id;
  else
    if not exists (select 1 from public.categories where org_id = p_org and id = p_id and archived_at is null) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    v_before := app.category_json(p_id);
    update public.categories set name = btrim(p_name), code = upper(btrim(p_code)), applies_to = p_applies_to,
      requires_accounting = p_requires_accounting, template_id = p_template, workflow_id = p_workflow
      where id = p_id;
    delete from public.category_departments where category_id = p_id;
    delete from public.category_approvers where category_id = p_id;
  end if;
  insert into public.category_departments (org_id, category_id, department_id)
    select distinct p_org, v_id, u from unnest(coalesce(p_departments, '{}')) u;
  insert into public.category_approvers (org_id, category_id, membership_id, role_id, department_id)
    select distinct p_org, v_id, a.membership_id, a.role_id, a.department_id
    from jsonb_to_recordset(p_approvers) as a (membership_id uuid, role_id uuid, department_id uuid);
  perform app.write_audit(p_org, case when p_id is null then 'category.created' else 'category.updated' end,
    'category', v_id, v_before, app.category_json(v_id));
  return v_id;
end $$;

create function public.archive_category(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  update public.categories set archived_at = now() where org_id = p_org and id = p_id and archived_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(p_org, 'category.archived', 'category', p_id);
end $$;

-- Numbering -------------------------------------------------------------------

create function public.save_numbering(p_org uuid, p_type text, p_prefix text, p_reset text, p_digits smallint)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  select jsonb_build_object('prefix', prefix, 'reset', reset, 'digits', digits) into v_before
    from public.number_sequences where org_id = p_org and document_type = p_type;
  if v_before is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.number_sequences set prefix = upper(btrim(p_prefix)), reset = p_reset, digits = p_digits
    where org_id = p_org and document_type = p_type;
  perform app.write_audit(p_org, 'numbering.updated', 'numbering', null,
    v_before || jsonb_build_object('document', p_type),
    jsonb_build_object('document', p_type, 'prefix', upper(btrim(p_prefix)), 'reset', p_reset, 'digits', p_digits));
end $$;

-- Starter set -----------------------------------------------------------------

create function public.add_starter_configuration(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_template uuid; v_workflow uuid; v_role uuid;
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if exists (select 1 from public.categories where org_id = p_org)
    or exists (select 1 from public.templates where org_id = p_org)
    or exists (select 1 from public.workflows where org_id = p_org) then
    raise exception 'already_configured' using errcode = '22023';
  end if;
  v_template := (public.save_template(p_org, null, 'request', 'General request', '[
    {"key":"justification","label":"Why is this needed?","type":"long_text","required":true},
    {"key":"supplier","label":"Preferred supplier","type":"short_text","required":false},
    {"key":"quotation","label":"Quotation","type":"file","required":false}]', null) ->> 'id')::uuid;
  perform public.save_template(p_org, null, 'expense_report', 'Monthly expense report', '[
    {"key":"summary","label":"Summary of the month","type":"long_text","required":true},
    {"key":"variances","label":"Unusual or unplanned spending","type":"long_text","required":false}]', null);
  perform public.save_template(p_org, null, 'narrative_report', 'Monthly narrative report', '[
    {"key":"achievements","label":"Key achievements","type":"long_text","required":true},
    {"key":"challenges","label":"Challenges","type":"long_text","required":true},
    {"key":"next_month","label":"Plan for next month","type":"long_text","required":true}]', null);
  v_workflow := (public.save_workflow(p_org, null, 'request', 'Standard approval',
    '[{"name":"Approval","approver_type":"category_approvers","required_approvals":1}]', null) ->> 'id')::uuid;
  select id into v_role from public.roles where org_id = p_org and system_key = 'finance' and archived_at is null;
  if v_role is not null then
    perform public.save_workflow(p_org, null, 'report', 'Finance review', jsonb_build_array(jsonb_build_object(
      'name', 'Finance review', 'approver_type', 'role', 'role_id', v_role, 'required_approvals', 1)), null);
  end if;
  select id into v_role from public.roles where org_id = p_org and system_key = 'approver' and archived_at is null;
  perform public.save_category(p_org, null, c.name, c.code, 'both', true, v_template, v_workflow, '{}',
    case when v_role is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('role_id', v_role)) end)
  from (values ('Office supplies', 'OFF'), ('Travel and transport', 'TRV'), ('Equipment', 'EQP'),
    ('Training and events', 'TRN'), ('General purchases', 'GEN')) c (name, code);
end $$;

-- Setup checks ------------------------------------------------------------------

create function public.setup_warnings(p_org uuid)
returns table (code text, subject_id uuid, subject text, found integer, needed integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_perm(p_org, 'config.manage') or app.has_perm(p_org, 'org.manage')
    or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with active_departments as (
    select d.id, d.name from public.departments d where d.org_id = p_org and d.archived_at is null
  ), requestable as (
    select c.id, c.name, c.workflow_id from public.categories c
    where c.org_id = p_org and c.archived_at is null and c.applies_to <> 'expense'
  ), category_needs as (
    -- One more than required, because an approver cannot approve their own request.
    select c.id, c.name, case when c.workflow_id is null then 2
      else (select max(s.required_approvals) + 1 from public.workflows w
        join public.workflow_steps s on s.workflow_version_id = w.current_version_id
        where w.id = c.workflow_id and s.approver_type = 'category_approvers') end as needed
    from requestable c
  ), category_found as (
    -- The weakest department decides: a category is only as usable as its least covered one.
    select n.id, n.name, n.needed, (
      select min((select count(*) from app.category_approvers_for(p_org, n.id, x.department_id)))::integer
      from (
        select d.id as department_id from active_departments d
        where not exists (select 1 from public.category_departments cd where cd.category_id = n.id)
          or exists (select 1 from public.category_departments cd where cd.category_id = n.id and cd.department_id = d.id)
        union all
        select null where not exists (select 1 from active_departments)
      ) x) as found
    from category_needs n where n.needed is not null
  )
  select 'category_approvers', f.id, f.name, f.found, f.needed::integer from category_found f where f.found < f.needed
  union all
  select 'workflow_step', w.id, w.name || ' → ' || s.name, n.found, s.required_approvals::integer
  from public.workflows w
  join public.workflow_steps s on s.workflow_version_id = w.current_version_id and s.approver_type <> 'category_approvers'
  cross join lateral (select count(*)::integer as found from app.step_approvers(p_org, s.id,
    case w.subject when 'request' then 'requests.approve' else 'reports.review' end)) n
  where w.org_id = p_org and w.archived_at is null and n.found < s.required_approvals
  union all
  select 'payers', null, null, n.found, 2
  from (select count(*)::integer as found from app.permission_holders(p_org, 'payments.record')) n where n.found < 2
  union all
  select 'department_head', d.id, d.name, 0, 1 from active_departments d
  where not exists (
    select 1 from app.current_grants(p_org) g join public.roles r on r.id = g.role_id and r.system_key = 'hod'
    where g.department_id = d.id);
end $$;

create function public.setup_counts(p_org uuid)
returns table (members bigint, departments bigint, roles bigint, categories bigint, templates bigint, workflows bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_member(p_org) or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select
    (select count(*) from public.memberships x where x.org_id = p_org and x.status <> 'left'),
    (select count(*) from public.departments x where x.org_id = p_org and x.archived_at is null),
    (select count(*) from public.roles x where x.org_id = p_org and x.archived_at is null),
    (select count(*) from public.categories x where x.org_id = p_org and x.archived_at is null),
    (select count(*) from public.templates x where x.org_id = p_org and x.archived_at is null),
    (select count(*) from public.workflows x where x.org_id = p_org and x.archived_at is null);
end $$;

-- Audit log -----------------------------------------------------------------------

create index audit_logs_org_page_idx on public.audit_logs (org_id, created_at desc, id);
drop index public.audit_logs_org_idx;

create function app.require_audit(p_org uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.has_perm(p_org, 'audit.view') or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end $$;

create function app.audit_person(p_org uuid, p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when p_user is null then 'System' else coalesce((
    select nullif(btrim(p.full_name), '') from public.profiles p
    where p.user_id = p_user and exists (
      select 1 from public.memberships m where m.org_id = p_org and m.user_id = p_user)), 'Platform or former user') end
$$;

create function public.list_audit(
  p_org uuid, p_search text default '', p_area text default null, p_person uuid default null,
  p_from date default null, p_to date default null, p_sort text default 'at', p_desc boolean default true,
  p_limit integer default 20, p_offset integer default 0
)
returns table (id uuid, action text, area text, person text, reason text, before jsonb, after jsonb,
  at timestamptz, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_zone text;
begin
  perform app.require_audit(p_org);
  select o.timezone into v_zone from public.organisations o where o.id = p_org;
  return query
  with people as materialized (
    select u.actor_user_id, app.audit_person(p_org, u.actor_user_id) as name
    from (select distinct l.actor_user_id from public.audit_logs l where l.org_id = p_org) u
  ), entries as (
    select l.id, l.action, l.entity_type, p.name, l.reason, l.before, l.after, l.created_at,
      lower(concat_ws(' ', translate(l.action, '._', '  '), translate(l.entity_type, '_', ' '), p.name, l.reason,
        l.after ->> 'name', l.before ->> 'name')) as haystack
    from public.audit_logs l
    join people p on p.actor_user_id is not distinct from l.actor_user_id
    where l.org_id = p_org
      and (p_area is null or l.entity_type = p_area)
      and (p_person is null or l.actor_user_id = p_person)
      and (p_from is null or l.created_at >= p_from::timestamp at time zone v_zone)
      and (p_to is null or l.created_at < (p_to + 1)::timestamp at time zone v_zone)
  )
  select e.id, e.action, e.entity_type, e.name, e.reason, e.before, e.after, e.created_at, count(*) over ()
  from entries e
  where not exists (
    select 1 from regexp_split_to_table(lower(btrim(left(coalesce(p_search, ''), 100))), '\s+') w
    where w <> '' and strpos(e.haystack, w) = 0
  )
  order by
    case when p_sort in ('action', 'person', 'area') and not p_desc then
      case p_sort when 'action' then e.action when 'person' then lower(e.name) else e.entity_type end end asc,
    case when p_sort in ('action', 'person', 'area') and p_desc then
      case p_sort when 'action' then e.action when 'person' then lower(e.name) else e.entity_type end end desc,
    case when p_sort = 'at' and not p_desc then e.created_at end asc,
    e.created_at desc, e.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

create function public.audit_filters(p_org uuid)
returns table (kind text, value text, label text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_audit(p_org);
  return query
  select 'area', x.entity_type, x.entity_type
    from (select distinct l.entity_type from public.audit_logs l where l.org_id = p_org) x
  union all
  select 'person', x.actor_user_id::text, app.audit_person(p_org, x.actor_user_id)
    from (select distinct l.actor_user_id from public.audit_logs l
      where l.org_id = p_org and l.actor_user_id is not null) x
  order by 1, 3;
end $$;

revoke execute on all functions in schema app from public, anon;
do $$
declare f text;
begin
  foreach f in array array[
    'list_approvers(uuid, text)',
    'save_template(uuid, uuid, text, text, jsonb, integer)', 'archive_template(uuid, uuid)',
    'save_workflow(uuid, uuid, text, text, jsonb, integer)', 'archive_workflow(uuid, uuid)',
    'save_category(uuid, uuid, text, text, text, boolean, uuid, uuid, uuid[], jsonb)', 'archive_category(uuid, uuid)',
    'save_numbering(uuid, text, text, text, smallint)', 'add_starter_configuration(uuid)',
    'setup_warnings(uuid)', 'setup_counts(uuid)',
    'list_audit(uuid, text, text, uuid, date, date, text, boolean, integer, integer)', 'audit_filters(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
