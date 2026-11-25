-- Paginated people listing and overview counts, calculated in the database.

create index memberships_org_status_idx on public.memberships (org_id, status);

create function public.list_members(
  p_org uuid,
  p_search text default '',
  p_department uuid default null,
  p_no_department boolean default false,
  p_role uuid default null,
  p_status text default null,
  p_sort text default 'name',
  p_desc boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, name text, status text, roles text[], department_names text[], total bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_member(p_org) or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with people as (
    select m.id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed member') as name, m.status,
      array(
        select distinct r.name from public.membership_roles mr
        join public.roles r on r.id = mr.role_id
        where mr.membership_id = m.id and mr.valid_from <= now()
          and (mr.valid_until is null or mr.valid_until > now())
          and r.archived_at is null
        order by r.name
      ) as roles,
      array(
        select d.name from public.department_members dm
        join public.departments d on d.id = dm.department_id and d.archived_at is null
        where dm.membership_id = m.id order by d.name
      ) as department_names
    from public.memberships m
    left join public.profiles p on p.user_id = m.user_id
    where m.org_id = p_org and m.status <> 'left'
      and (p_status is null or m.status = p_status)
      and (p_department is null or exists (
        select 1 from public.department_members dm where dm.membership_id = m.id and dm.department_id = p_department))
      and (not coalesce(p_no_department, false) or not exists (
        select 1 from public.department_members dm where dm.membership_id = m.id))
      and (p_role is null or exists (
        select 1 from public.membership_roles mr where mr.membership_id = m.id and mr.role_id = p_role
          and mr.valid_from <= now() and (mr.valid_until is null or mr.valid_until > now())))
  ), keyed as (
    select pe.*,
      lower(case p_sort
        when 'role' then array_to_string(pe.roles, ', ')
        when 'departments' then array_to_string(pe.department_names, ', ')
        when 'status' then pe.status
        else pe.name end) as sort_key,
      lower(concat_ws(' ', pe.name, array_to_string(pe.roles, ' '), array_to_string(pe.department_names, ' '))) as haystack
    from people pe
  )
  select k.id, k.name, k.status, k.roles, k.department_names, count(*) over ()
  from keyed k
  where not exists (
    -- Every word must appear; plain matching, so % and _ are not special.
    select 1 from regexp_split_to_table(lower(btrim(left(coalesce(p_search, ''), 100))), '\s+') w
    where w <> '' and strpos(k.haystack, w) = 0
  )
  order by
    case when not coalesce(p_desc, false) then k.sort_key end asc,
    case when coalesce(p_desc, false) then k.sort_key end desc,
    lower(k.name), k.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

create function public.department_overview(p_org uuid)
returns table (department_id uuid, people bigint, head text, deputies text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_member(p_org) or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with holders as (
    select mr.department_id, coalesce(nullif(btrim(p.full_name), ''), 'Unnamed member') as name,
      mr.valid_until is not null as deputy
    from public.membership_roles mr
    join public.roles r on r.id = mr.role_id and r.system_key = 'hod'
    join public.memberships m on m.id = mr.membership_id and m.status <> 'left'
    left join public.profiles p on p.user_id = m.user_id
    where mr.org_id = p_org and mr.valid_from <= now() and (mr.valid_until is null or mr.valid_until > now())
  )
  select d.id,
    (select count(*) from public.department_members dm
      join public.memberships m on m.id = dm.membership_id and m.status <> 'left'
      where dm.department_id = d.id),
    (select h.name from holders h where h.department_id = d.id and not h.deputy limit 1),
    array(select h.name from holders h where h.department_id = d.id and h.deputy order by h.name)
  from public.departments d
  where d.org_id = p_org and d.archived_at is null;
end $$;

create function public.role_overview(p_org uuid)
returns table (role_id uuid, people bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.is_member(p_org) or app.has_support_access(p_org)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select r.id, (
    select count(distinct mr.membership_id) from public.membership_roles mr
    join public.memberships m on m.id = mr.membership_id and m.status <> 'left'
    where mr.role_id = r.id and mr.valid_from <= now() and (mr.valid_until is null or mr.valid_until > now())
  )
  from public.roles r where r.org_id = p_org and r.archived_at is null;
end $$;

revoke execute on function
  public.list_members(uuid, text, uuid, boolean, uuid, text, text, boolean, integer, integer),
  public.department_overview(uuid), public.role_overview(uuid)
from public, anon, authenticated;
grant execute on function
  public.list_members(uuid, text, uuid, boolean, uuid, text, text, boolean, integer, integer),
  public.department_overview(uuid), public.role_overview(uuid)
to authenticated;
