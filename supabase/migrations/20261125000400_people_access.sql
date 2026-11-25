-- Departments, roles, invitations and member lifecycle.

create table public.department_members (
  org_id uuid not null,
  department_id uuid not null,
  membership_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (department_id, membership_id),
  foreign key (org_id, department_id) references public.departments (org_id, id),
  foreign key (org_id, membership_id) references public.memberships (org_id, id)
);
create index department_members_member_idx on public.department_members (membership_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id),
  email text not null check (email = lower(email) and char_length(email) <= 254),
  role_id uuid not null,
  department_id uuid,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key (org_id, role_id) references public.roles (org_id, id),
  foreign key (org_id, department_id) references public.departments (org_id, id),
  foreign key (org_id, invited_by) references public.memberships (org_id, id)
);
create unique index invitations_one_open on public.invitations (org_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.department_members enable row level security;
alter table public.invitations enable row level security;
revoke all on public.department_members, public.invitations from anon, authenticated;
grant select on public.department_members to authenticated;
grant select (id, org_id, email, role_id, department_id, expires_at, accepted_at, revoked_at, created_at)
  on public.invitations to authenticated;
create policy department_members_read on public.department_members for select to authenticated
  using (app.is_member(org_id) or app.has_support_access(org_id));
create policy invitations_read on public.invitations for select to authenticated
  using (app.has_perm(org_id, 'members.manage') or app.has_support_access(org_id));

-- Internal helpers ----------------------------------------------------------

-- Serialises access changes per organisation so safety checks cannot race.
create function app.lock_org(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.organisations where id = p_org for update;
end $$;

create function app.role_is_department_scoped(p_role uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.role_permissions where role_id = p_role and scope = 'department')
$$;

create function app.assert_admin_remains(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.membership_roles mr
    join public.roles r on r.id = mr.role_id and r.system_key = 'admin'
    join public.memberships m on m.id = mr.membership_id and m.status = 'active'
    where mr.org_id = p_org and mr.valid_until is null and mr.valid_from <= now()
  ) then
    raise exception 'last_admin' using errcode = '42501';
  end if;
end $$;

-- Roles that control access itself may only be handed out by people who manage roles.
create function app.require_can_grant(p_org uuid, p_role uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'members.manage');
  if exists (
    select 1 from public.role_permissions
    where role_id = p_role and permission_key in ('org.manage', 'members.manage', 'roles.manage', 'config.manage')
  ) then
    perform app.require_perm(p_org, 'roles.manage');
  end if;
end $$;

create function app.assign_role(
  p_org uuid, p_membership uuid, p_role uuid, p_department uuid, p_until timestamptz, p_by uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_key text; v_found boolean;
begin
  select system_key, true into v_key, v_found from public.roles
    where org_id = p_org and id = p_role and archived_at is null;
  if v_found is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if app.role_is_department_scoped(p_role) then
    if p_department is null then raise exception 'department_required' using errcode = '22023'; end if;
    if not exists (select 1 from public.departments where org_id = p_org and id = p_department and archived_at is null) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    p_department := null;
  end if;
  if p_until is not null and p_until <= now() then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if v_key = 'hod' and p_until is null and exists (
    select 1 from public.membership_roles mr
    join public.memberships m on m.id = mr.membership_id and m.status <> 'left'
    where mr.role_id = p_role and mr.department_id = p_department
      and mr.valid_until is null and mr.membership_id <> p_membership
  ) then
    raise exception 'hod_exists' using errcode = '22023';
  end if;
  insert into public.membership_roles (org_id, membership_id, role_id, department_id, valid_until, granted_by)
  values (p_org, p_membership, p_role, p_department, p_until, p_by)
  on conflict (membership_id, role_id, department_id)
  do update set valid_until = excluded.valid_until, valid_from = now(), granted_by = excluded.granted_by;
  if p_department is not null then
    insert into public.department_members (org_id, department_id, membership_id)
    values (p_org, p_department, p_membership) on conflict do nothing;
  end if;
end $$;

-- Departments ---------------------------------------------------------------

create function public.save_department(p_org uuid, p_id uuid, p_name text, p_code text, p_parent uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_before jsonb;
begin
  perform app.require_perm(p_org, 'org.manage');
  perform app.lock_org(p_org);
  if p_parent is not null and not exists (
    select 1 from public.departments where org_id = p_org and id = p_parent and archived_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_id is null then
    insert into public.departments (org_id, name, code, parent_id)
    values (p_org, btrim(p_name), upper(btrim(p_code)), p_parent) returning id into v_id;
  else
    if p_parent is not null and exists (
      with recursive chain as (
        select id, parent_id from public.departments where org_id = p_org and id = p_parent
        union
        select d.id, d.parent_id from public.departments d join chain c on d.id = c.parent_id
      ) select 1 from chain where id = p_id
    ) then
      raise exception 'department_cycle' using errcode = '22023';
    end if;
    select jsonb_build_object('name', name, 'code', code, 'parent_id', parent_id) into v_before
      from public.departments where org_id = p_org and id = p_id and archived_at is null;
    if v_before is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    update public.departments set name = btrim(p_name), code = upper(btrim(p_code)), parent_id = p_parent
      where org_id = p_org and id = p_id;
  end if;
  perform app.write_audit(p_org, case when p_id is null then 'department.created' else 'department.updated' end,
    'department', v_id, v_before,
    jsonb_build_object('name', btrim(p_name), 'code', upper(btrim(p_code)), 'parent_id', p_parent));
  return v_id;
end $$;

create function public.archive_department(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'org.manage');
  perform app.lock_org(p_org);
  if exists (select 1 from public.department_members where org_id = p_org and department_id = p_id)
    or exists (select 1 from public.departments where org_id = p_org and parent_id = p_id and archived_at is null)
    or exists (select 1 from public.invitations where org_id = p_org and department_id = p_id
      and accepted_at is null and revoked_at is null and expires_at > now()) then
    raise exception 'department_in_use' using errcode = '22023';
  end if;
  update public.departments set archived_at = now() where org_id = p_org and id = p_id and archived_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(p_org, 'department.archived', 'department', p_id);
end $$;

create function public.set_member_departments(
  p_org uuid, p_membership uuid, p_departments uuid[], p_primary uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ids uuid[] := coalesce(p_departments, '{}'); v_before uuid[];
begin
  perform app.require_perm(p_org, 'members.manage');
  perform app.lock_org(p_org);
  if not exists (select 1 from public.memberships where org_id = p_org and id = p_membership and status <> 'left') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_primary is not null and not p_primary = any (v_ids) then
    raise exception 'primary_department' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_ids) u where not exists (
    select 1 from public.departments d where d.org_id = p_org and d.id = u and d.archived_at is null)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.membership_roles where membership_id = p_membership
    and department_id is not null and not department_id = any (v_ids)
    and (valid_until is null or valid_until > now())) then
    raise exception 'department_role_active' using errcode = '22023';
  end if;
  select coalesce(array_agg(department_id), '{}') into v_before
    from public.department_members where membership_id = p_membership;
  update public.memberships set primary_department_id = p_primary where id = p_membership;
  delete from public.department_members where membership_id = p_membership and not department_id = any (v_ids);
  insert into public.department_members (org_id, department_id, membership_id)
    select distinct p_org, u, p_membership from unnest(v_ids) u on conflict do nothing;
  perform app.write_audit(p_org, 'member.departments_changed', 'membership', p_membership,
    jsonb_build_object('departments', v_before),
    jsonb_build_object('departments', v_ids, 'primary', p_primary));
end $$;

-- Roles ---------------------------------------------------------------------

-- p_permissions: [{"key": "requests.view", "scope": "org"}, ...]
create function public.save_role(p_org uuid, p_id uuid, p_name text, p_permissions jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_system text; v_found boolean; v_before jsonb; v_scopes text[];
begin
  perform app.require_perm(p_org, 'roles.manage');
  perform app.lock_org(p_org);
  if jsonb_typeof(p_permissions) is distinct from 'array' or exists (
    select 1 from jsonb_to_recordset(p_permissions) as x (key text, scope text)
    left join public.permissions p on p.key = x.key
    where p.key is null or x.scope is null or not x.scope = any (p.allowed_scopes)
  ) then
    raise exception 'invalid_permissions' using errcode = '22023';
  end if;
  select array_agg(distinct x.scope) into v_scopes from jsonb_to_recordset(p_permissions) as x (key text, scope text);
  -- A grant is either for one department or for the whole organisation, never both.
  if 'department' = any (v_scopes) and v_scopes && array['org', 'category'] then
    raise exception 'mixed_scopes' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.roles (org_id, name) values (p_org, btrim(p_name)) returning id into v_id;
  else
    select system_key, true into v_system, v_found from public.roles
      where org_id = p_org and id = p_id and archived_at is null;
    if v_found is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if v_system = 'admin' then raise exception 'admin_role_locked' using errcode = '42501'; end if;
    if app.role_is_department_scoped(p_id) is distinct from coalesce('department' = any (v_scopes), false)
      and exists (select 1 from public.membership_roles where role_id = p_id) then
      raise exception 'role_scope_in_use' using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object('key', permission_key, 'scope', scope)) into v_before
      from public.role_permissions where role_id = p_id;
    update public.roles set name = btrim(p_name) where id = p_id;
    delete from public.role_permissions where role_id = p_id;
  end if;
  insert into public.role_permissions (org_id, role_id, permission_key, scope)
    select distinct p_org, v_id, x.key, x.scope from jsonb_to_recordset(p_permissions) as x (key text, scope text);
  perform app.write_audit(p_org, case when p_id is null then 'role.created' else 'role.updated' end,
    'role', v_id, v_before, jsonb_build_object('name', btrim(p_name), 'permissions', p_permissions));
  return v_id;
end $$;

create function public.archive_role(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'roles.manage');
  perform app.lock_org(p_org);
  if exists (select 1 from public.membership_roles where org_id = p_org and role_id = p_id)
    or exists (select 1 from public.invitations where org_id = p_org and role_id = p_id
      and accepted_at is null and revoked_at is null and expires_at > now()) then
    raise exception 'role_in_use' using errcode = '22023';
  end if;
  update public.roles set archived_at = now()
    where org_id = p_org and id = p_id and system_key is null and archived_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(p_org, 'role.archived', 'role', p_id);
end $$;

create function public.grant_role(
  p_org uuid, p_membership uuid, p_role uuid, p_department uuid default null, p_until timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_can_grant(p_org, p_role);
  -- Managing people is not enough to raise your own access.
  if p_membership = app.membership_id(p_org) then
    perform app.require_perm(p_org, 'roles.manage');
  end if;
  perform app.lock_org(p_org);
  if not exists (select 1 from public.memberships where org_id = p_org and id = p_membership and status = 'active') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform app.assign_role(p_org, p_membership, p_role, p_department, p_until, app.membership_id(p_org));
  perform app.assert_admin_remains(p_org);
  perform app.write_audit(p_org, 'role.granted', 'membership', p_membership, null,
    jsonb_build_object('role_id', p_role, 'department_id', p_department, 'until', p_until));
end $$;

create function public.revoke_role(p_org uuid, p_grant uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_row public.membership_roles;
begin
  perform app.require_perm(p_org, 'members.manage');
  perform app.lock_org(p_org);
  select * into v_row from public.membership_roles where org_id = p_org and id = p_grant;
  if v_row.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_can_grant(p_org, v_row.role_id);
  delete from public.membership_roles where id = p_grant;
  perform app.assert_admin_remains(p_org);
  perform app.write_audit(p_org, 'role.revoked', 'membership', v_row.membership_id,
    jsonb_build_object('role_id', v_row.role_id, 'department_id', v_row.department_id));
end $$;

-- Member lifecycle ----------------------------------------------------------

create function public.set_member_status(p_org uuid, p_membership uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before text; v_role uuid;
begin
  perform app.require_perm(p_org, 'members.manage');
  perform app.lock_org(p_org);
  if p_status is null or p_status not in ('active', 'suspended', 'left') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select status into v_before from public.memberships where org_id = p_org and id = p_membership;
  if v_before is null or v_before = 'left' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_membership = app.membership_id(p_org) then raise exception 'own_access' using errcode = '42501'; end if;
  -- Only people who could grant a member's roles may take that member's access away.
  for v_role in select role_id from public.membership_roles where membership_id = p_membership loop
    perform app.require_can_grant(p_org, v_role);
  end loop;
  update public.memberships set status = p_status,
    primary_department_id = case when p_status = 'left' then null else primary_department_id end
    where id = p_membership;
  if p_status = 'left' then
    delete from public.membership_roles where membership_id = p_membership;
    delete from public.department_members where membership_id = p_membership;
  end if;
  perform app.assert_admin_remains(p_org);
  perform app.write_audit(p_org, 'member.status_changed', 'membership', p_membership,
    jsonb_build_object('status', v_before), jsonb_build_object('status', p_status), btrim(p_reason));
end $$;

-- Invitations ---------------------------------------------------------------

create function public.invite_member(p_org uuid, p_email text, p_role uuid, p_department uuid default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  perform app.require_can_grant(p_org, p_role);
  perform app.lock_org(p_org);
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if not exists (select 1 from public.roles where org_id = p_org and id = p_role and archived_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if app.role_is_department_scoped(p_role) and p_department is null then
    raise exception 'department_required' using errcode = '22023';
  end if;
  if p_department is not null and not exists (
    select 1 from public.departments where org_id = p_org and id = p_department and archived_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.org_id = p_org and lower(u.email) = v_email and m.status <> 'left') then
    raise exception 'already_member' using errcode = '22023';
  end if;
  update public.invitations set revoked_at = now()
    where org_id = p_org and email = v_email and accepted_at is null and revoked_at is null;
  insert into public.invitations (org_id, email, role_id, department_id, token_hash, expires_at, invited_by)
    values (p_org, v_email, p_role, p_department, app.hash_token(v_token), now() + interval '7 days', app.membership_id(p_org))
    returning id into v_id;
  perform app.write_audit(p_org, 'invitation.created', 'invitation', v_id, null,
    jsonb_build_object('email', v_email, 'role_id', p_role, 'department_id', p_department));
  return v_token;
end $$;

create function public.revoke_invitation(p_org uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_perm(p_org, 'members.manage');
  update public.invitations set revoked_at = now()
    where org_id = p_org and id = p_id and accepted_at is null and revoked_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(p_org, 'invitation.revoked', 'invitation', p_id);
end $$;

create function public.peek_invitation(p_token text)
returns table (email text, state text, has_account boolean, org_name text)
language sql stable security definer set search_path = '' as $$
  select i.email,
    case when i.accepted_at is not null then 'used' when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired' when o.status = 'suspended' then 'revoked' else 'valid' end,
    exists (select 1 from auth.users u where lower(u.email) = i.email), o.name
  from public.invitations i join public.organisations o on o.id = i.org_id
  where i.token_hash = app.hash_token(p_token)
$$;

create function public.accept_invitation(p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_invite public.invitations; v_email text; v_org uuid; v_membership uuid; v_slug text;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
  -- Organisation first, matching the lock order of every other access change.
  select org_id into v_org from public.invitations where token_hash = app.hash_token(p_token);
  perform app.lock_org(v_org);
  select * into v_invite from public.invitations where token_hash = app.hash_token(p_token) for update;
  if v_invite.id is null or v_invite.accepted_at is not null or v_invite.revoked_at is not null
    or v_invite.expires_at <= now() then
    raise exception 'invite_invalid' using errcode = '22023';
  end if;
  if v_email is distinct from v_invite.email then
    raise exception 'invite_email_mismatch' using errcode = '42501';
  end if;
  select slug into v_slug from public.organisations where id = v_org and status <> 'suspended';
  if v_slug is null then raise exception 'invite_invalid' using errcode = '22023'; end if;
  -- Someone suspended cannot use an old link to get back in; someone who left may be re-invited.
  insert into public.memberships (org_id, user_id, primary_department_id)
    values (v_org, auth.uid(), v_invite.department_id)
  on conflict (org_id, user_id) do update
    set status = 'active', primary_department_id = excluded.primary_department_id
    where public.memberships.status = 'left'
  returning id into v_membership;
  if v_membership is null then raise exception 'already_member' using errcode = '22023'; end if;
  if v_invite.department_id is not null then
    insert into public.department_members (org_id, department_id, membership_id)
    values (v_org, v_invite.department_id, v_membership) on conflict do nothing;
  end if;
  perform app.assign_role(v_org, v_membership, v_invite.role_id, v_invite.department_id, null, v_invite.invited_by);
  update public.invitations set accepted_at = now() where id = v_invite.id;
  perform app.write_audit(v_org, 'invitation.accepted', 'membership', v_membership);
  return v_slug;
end $$;

revoke execute on all functions in schema app from public, anon;
revoke execute on function
  public.save_department(uuid, uuid, text, text, uuid), public.archive_department(uuid, uuid),
  public.set_member_departments(uuid, uuid, uuid[], uuid), public.save_role(uuid, uuid, text, jsonb),
  public.archive_role(uuid, uuid), public.grant_role(uuid, uuid, uuid, uuid, timestamptz),
  public.revoke_role(uuid, uuid), public.set_member_status(uuid, uuid, text, text),
  public.invite_member(uuid, text, uuid, uuid), public.revoke_invitation(uuid, uuid),
  public.peek_invitation(text), public.accept_invitation(text)
from public, anon, authenticated;
grant execute on function
  public.save_department(uuid, uuid, text, text, uuid), public.archive_department(uuid, uuid),
  public.set_member_departments(uuid, uuid, uuid[], uuid), public.save_role(uuid, uuid, text, jsonb),
  public.archive_role(uuid, uuid), public.grant_role(uuid, uuid, uuid, uuid, timestamptz),
  public.revoke_role(uuid, uuid), public.set_member_status(uuid, uuid, text, text),
  public.invite_member(uuid, text, uuid, uuid), public.revoke_invitation(uuid, uuid),
  public.accept_invitation(text)
to authenticated;
grant execute on function public.peek_invitation(text) to service_role;
