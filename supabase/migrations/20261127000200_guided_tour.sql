-- The first-visit tour is shown once per person per organisation, on any device.
alter table public.memberships add column tour_completed_at timestamptz;

create function public.tour_needed(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select m.tour_completed_at is null from public.memberships m
    where m.id = app.membership_id(p_org) and m.status = 'active'), false)
$$;

-- Finishing or skipping both count; replaying later changes nothing.
create function public.finish_tour(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.memberships set tour_completed_at = coalesce(tour_completed_at, now())
    where id = app.membership_id(p_org) and status = 'active';
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
end $$;

revoke execute on function public.tour_needed(uuid), public.finish_tour(uuid) from public, anon, authenticated;
grant execute on function public.tour_needed(uuid), public.finish_tour(uuid) to authenticated;
