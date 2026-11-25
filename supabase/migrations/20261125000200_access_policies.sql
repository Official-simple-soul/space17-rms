-- Authorisation helpers, grants and row level security.

create function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

create function app.is_aal2() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;

create function app.membership_id(p_org uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id
  from public.memberships m
  join public.organisations o on o.id = m.org_id
  where m.org_id = p_org
    and m.user_id = (select auth.uid())
    and m.status = 'active'
    and o.status <> 'suspended'
$$;

create function app.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.membership_id(p_org) is not null
$$;

-- Category scope is added with the approval engine; until then it grants nothing.
create function app.has_perm(
  p_org uuid, p_key text, p_department uuid default null, p_owner uuid default null
) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.membership_roles mr
    join public.roles r on r.org_id = mr.org_id and r.id = mr.role_id and r.archived_at is null
    join public.role_permissions rp on rp.role_id = r.id and rp.permission_key = p_key
    where mr.org_id = p_org
      and mr.membership_id = app.membership_id(p_org)
      and mr.valid_from <= now()
      and (mr.valid_until is null or mr.valid_until > now())
      and case rp.scope
        when 'org' then mr.department_id is null
        when 'department' then mr.department_id is not null and mr.department_id = p_department
        when 'own' then p_owner is not null and p_owner = mr.membership_id
        else false
      end
  )
$$;

create function app.has_support_access(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_platform_admin() and app.is_aal2() and exists (
    select 1 from public.support_sessions s
    where s.org_id = p_org
      and s.admin_user_id = (select auth.uid())
      and s.ended_at is null
      and s.starts_at <= now()
      and s.expires_at > now()
  )
$$;

create function app.shares_org(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = p_user and (app.is_member(m.org_id) or app.has_support_access(m.org_id))
  )
$$;

grant execute on function
  app.is_platform_admin(), app.is_aal2(), app.membership_id(uuid), app.is_member(uuid),
  app.has_perm(uuid, text, uuid, uuid), app.has_support_access(uuid), app.shares_org(uuid)
to authenticated;

-- Remove anything the platform granted automatically, then grant deliberately.
revoke all on all tables in schema public from anon, authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

grant select (user_id, full_name, avatar_path) on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select on public.organisations, public.departments, public.memberships, public.permissions,
  public.roles, public.role_permissions, public.membership_roles, public.access_requests,
  public.support_sessions, public.audit_logs to authenticated;
grant select (id, email, expires_at, accepted_at, revoked_at, created_org_id, created_at)
  on public.org_invites to authenticated;
grant select on public.platform_admins to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or app.shares_org(user_id));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy platform_admins_read_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy organisations_read on public.organisations for select to authenticated
  using (app.is_member(id) or app.is_platform_admin());

create policy departments_read on public.departments for select to authenticated
  using (app.is_member(org_id) or app.has_support_access(org_id));
create policy memberships_read on public.memberships for select to authenticated
  using (app.is_member(org_id) or app.has_support_access(org_id));
create policy roles_read on public.roles for select to authenticated
  using (app.is_member(org_id) or app.has_support_access(org_id));
create policy role_permissions_read on public.role_permissions for select to authenticated
  using (app.is_member(org_id) or app.has_support_access(org_id));
create policy membership_roles_read on public.membership_roles for select to authenticated
  using (app.is_member(org_id) or app.has_support_access(org_id));
create policy permissions_read on public.permissions for select to authenticated using (true);

create policy org_invites_read on public.org_invites for select to authenticated
  using (app.is_platform_admin());
create policy access_requests_read on public.access_requests for select to authenticated
  using (app.is_platform_admin());
create policy support_sessions_read on public.support_sessions for select to authenticated
  using (admin_user_id = (select auth.uid()) or app.has_perm(org_id, 'org.manage'));
create policy audit_logs_read on public.audit_logs for select to authenticated
  using (
    (org_id is not null and (app.has_perm(org_id, 'audit.view') or app.has_support_access(org_id)))
    or (org_id is null and app.is_platform_admin())
  );
