-- People, roles, departments and configuration are for those who manage or audit them. Everyone else
-- sees only themselves, their own departments and the categories they can use.

create function app.sees_directory(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_perm(p_org, 'members.manage') or app.has_perm(p_org, 'org.manage')
    or app.has_perm(p_org, 'roles.manage') or app.has_perm(p_org, 'config.manage')
    or app.has_perm(p_org, 'audit.view') or app.has_support_access(p_org)
$$;

-- Work that spans departments needs their names for filters, but nothing more.
create function app.sees_all_departments(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.sees_directory(p_org) or exists (
    select 1 from app.current_grants(p_org) g
    join public.role_permissions rp on rp.role_id = g.role_id
    where g.membership_id = app.membership_id(p_org) and rp.scope in ('org', 'category')
      and (rp.scope = 'category' or g.department_id is null)
      and rp.permission_key in ('requests.view', 'requests.approve', 'expenses.view', 'reports.view',
        'reports.review', 'payments.record', 'payments.void'))
$$;

create function app.my_departments() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select dm.department_id from public.department_members dm
    where dm.membership_id = app.membership_id(dm.org_id)
  union
  select mr.department_id from public.membership_roles mr
    where mr.department_id is not null and mr.membership_id = app.membership_id(mr.org_id)
      and mr.valid_from <= now() and (mr.valid_until is null or mr.valid_until > now())
$$;

create function app.sees_category(p_org uuid, p_category uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.sees_all_departments(p_org) or (app.is_member(p_org) and (
    not exists (select 1 from public.category_departments x where x.category_id = p_category)
    or exists (select 1 from public.category_departments x
      where x.category_id = p_category and x.department_id in (select app.my_departments()))))
$$;

create or replace function app.shares_org(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.user_id = p_user and app.sees_directory(m.org_id))
$$;

alter policy memberships_read on public.memberships
  using (app.sees_directory(org_id) or id = app.membership_id(org_id));
alter policy membership_roles_read on public.membership_roles
  using (app.sees_directory(org_id) or membership_id = app.membership_id(org_id));
alter policy department_members_read on public.department_members
  using (app.sees_directory(org_id) or membership_id = app.membership_id(org_id));
alter policy roles_read on public.roles using (app.sees_directory(org_id));
alter policy role_permissions_read on public.role_permissions using (app.sees_directory(org_id));
alter policy departments_read on public.departments
  using (app.sees_all_departments(org_id) or id in (select app.my_departments()));
alter policy categories_read on public.categories using (app.sees_category(org_id, id));
alter policy category_departments_read on public.category_departments
  using (app.sees_all_departments(org_id) or department_id in (select app.my_departments()));

do $$
declare t text;
begin
  foreach t in array array['category_approvers', 'templates', 'template_versions', 'workflows',
    'workflow_versions', 'workflow_steps', 'number_sequences'] loop
    execute format('alter policy %I on public.%I using (app.sees_directory(org_id))', t || '_read', t);
  end loop;
end $$;

-- Functions that answered any member now use the same rule.
do $$
declare f record; v_old text; v_new text;
begin
  for f in select p.oid, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('list_members', 'department_overview', 'role_overview', 'setup_counts') loop
    v_old := pg_get_functiondef(f.oid);
    v_new := replace(v_old, 'if not (app.is_member(p_org) or app.has_support_access(p_org)) then',
      'if not app.sees_directory(p_org) then');
    if v_new = v_old then raise exception 'unexpected definition of %', f.proname; end if;
    execute v_new;
  end loop;
end $$;

-- Approval steps are for people filling in a request of that category.
create or replace function public.preview_steps(p_category uuid, p_total bigint)
returns table (name text, who text, required smallint)
language plpgsql stable security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.categories where id = p_category;
  if v_org is null or not (
    (app.has_perm(v_org, 'requests.create', null, app.membership_id(v_org)) and app.sees_category(v_org, p_category))
    or exists (select 1 from public.requests r
      where r.category_id = p_category and r.requester_id = app.membership_id(v_org))) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return query select s.name, app.step_label(s.approver_type, s.role_id, s.membership_id), s.required_approvals
    from app.steps_for(p_category, coalesce(p_total, 0)) s order by s.n;
end $$;

revoke execute on all functions in schema app from public, anon;
grant execute on function app.sees_directory(uuid), app.sees_all_departments(uuid), app.my_departments(),
  app.sees_category(uuid, uuid), app.shares_org(uuid), app.membership_id(uuid) to authenticated;
