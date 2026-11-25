-- Audited, transactional operations. Clients never write these tables directly.

create function app.write_audit(
  p_org uuid, p_action text, p_entity text, p_id uuid,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (org_id, actor_user_id, action, entity_type, entity_id, before, after, reason)
  values (p_org, auth.uid(), p_action, p_entity, p_id, p_before, p_after, p_reason)
$$;

create function app.hash_token(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

create function app.require_platform_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not app.is_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
end $$;

create function app.require_perm(p_org uuid, p_key text, p_mfa boolean default true) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_perm(p_org, p_key) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_mfa and not app.is_aal2() then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
end $$;

-- Default roles copied into each new organisation.
create function app.seed_roles(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.roles (org_id, name, system_key) values
    (p_org, 'Organisation admin', 'admin'),
    (p_org, 'Finance', 'finance'),
    (p_org, 'Approver', 'approver'),
    (p_org, 'Auditor', 'auditor'),
    (p_org, 'Head of department', 'hod'),
    (p_org, 'Staff', 'staff');

  insert into public.role_permissions (org_id, role_id, permission_key, scope)
  select p_org, r.id, v.key, v.scope
  from (values
    ('admin', 'org.manage', 'org'), ('admin', 'members.manage', 'org'),
    ('admin', 'roles.manage', 'org'), ('admin', 'config.manage', 'org'),
    ('admin', 'requests.view', 'org'), ('admin', 'expenses.view', 'org'),
    ('admin', 'reports.view', 'org'), ('admin', 'exports.create', 'org'),
    ('admin', 'audit.view', 'org'),
    ('finance', 'requests.view', 'org'), ('finance', 'payments.record', 'org'),
    ('finance', 'payments.void', 'org'), ('finance', 'expenses.view', 'org'),
    ('finance', 'reports.view', 'org'), ('finance', 'reports.review', 'org'),
    ('finance', 'receipts.issue', 'org'), ('finance', 'receipts.void', 'org'),
    ('finance', 'periods.close', 'org'), ('finance', 'exports.create', 'org'),
    ('approver', 'requests.view', 'category'), ('approver', 'requests.approve', 'category'),
    ('auditor', 'requests.view', 'org'), ('auditor', 'expenses.view', 'org'),
    ('auditor', 'reports.view', 'org'), ('auditor', 'exports.create', 'org'),
    ('auditor', 'audit.view', 'org'),
    ('hod', 'requests.view', 'department'), ('hod', 'expenses.view', 'department'),
    ('hod', 'expenses.accept', 'department'), ('hod', 'reports.view', 'department'),
    ('hod', 'reports.submit', 'department'), ('hod', 'exports.create', 'department')
  ) as v (role_key, key, scope)
  join public.roles r on r.org_id = p_org and r.system_key = v.role_key;

  insert into public.role_permissions (org_id, role_id, permission_key, scope)
  select p_org, r.id, k, 'own'
  from public.roles r
  cross join unnest(array['requests.create', 'requests.view', 'expenses.create', 'expenses.view']) as k
  where r.org_id = p_org and r.system_key in ('admin', 'finance', 'approver', 'hod', 'staff');
end $$;

-- Organisation invites ------------------------------------------------------

create function public.create_org_invite(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  perform app.require_platform_admin();
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  update public.org_invites set revoked_at = now()
    where email = v_email and accepted_at is null and revoked_at is null;
  insert into public.org_invites (email, token_hash, expires_at, invited_by)
    values (v_email, app.hash_token(v_token), now() + interval '7 days', auth.uid())
    returning id into v_id;
  update public.access_requests set status = 'invited' where email = v_email and status = 'pending';
  perform app.write_audit(null, 'org_invite.created', 'org_invite', v_id, null, jsonb_build_object('email', v_email));
  return v_token;
end $$;

create function public.revoke_org_invite(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform_admin();
  update public.org_invites set revoked_at = now()
    where id = p_id and accepted_at is null and revoked_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(null, 'org_invite.revoked', 'org_invite', p_id);
end $$;

-- Server-only: validates a link before an account exists.
create function public.peek_org_invite(p_token text)
returns table (email text, state text, has_account boolean)
language sql stable security definer set search_path = '' as $$
  select i.email,
    case
      when i.accepted_at is not null then 'used'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end,
    exists (select 1 from auth.users u where lower(u.email) = i.email)
  from public.org_invites i
  where i.token_hash = app.hash_token(p_token)
$$;

create function public.accept_org_invite(p_token text, p_name text, p_slug text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.org_invites;
  v_email text;
  v_org uuid;
  v_membership uuid;
begin
  if auth.uid() is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select lower(u.email) into v_email from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null;
  select * into v_invite from public.org_invites
    where token_hash = app.hash_token(p_token) for update;
  if v_invite.id is null or v_invite.accepted_at is not null
     or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'invite_invalid' using errcode = '22023';
  end if;
  if v_email is distinct from v_invite.email then
    raise exception 'invite_email_mismatch' using errcode = '42501';
  end if;

  insert into public.organisations (name, slug) values (btrim(p_name), p_slug) returning id into v_org;
  insert into public.memberships (org_id, user_id) values (v_org, auth.uid()) returning id into v_membership;
  perform app.seed_roles(v_org);
  insert into public.membership_roles (org_id, membership_id, role_id)
    select v_org, v_membership, r.id from public.roles r
    where r.org_id = v_org and r.system_key = 'admin';
  update public.org_invites set accepted_at = now(), created_org_id = v_org where id = v_invite.id;
  perform app.write_audit(v_org, 'organisation.created', 'organisation', v_org, null,
    jsonb_build_object('name', btrim(p_name), 'slug', p_slug));
  return p_slug;
end $$;

-- Public access requests (server-only so it can be rate limited) -------------

create function public.submit_access_request(
  p_org_name text, p_contact_name text, p_email text, p_message text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.access_requests where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.access_requests (org_name, contact_name, email, message)
  values (btrim(p_org_name), btrim(p_contact_name), lower(btrim(p_email)), nullif(btrim(p_message), ''))
  on conflict do nothing;
end $$;

create function public.decline_access_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_platform_admin();
  update public.access_requests set status = 'declined' where id = p_id and status = 'pending';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(null, 'access_request.declined', 'access_request', p_id);
end $$;

-- Organisation management ---------------------------------------------------

create function public.update_organisation(
  p_org uuid, p_name text, p_timezone text, p_fiscal_month smallint
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform app.require_perm(p_org, 'org.manage');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  select jsonb_build_object('name', name, 'timezone', timezone, 'fiscal_month', fiscal_year_start_month)
    into v_before from public.organisations where id = p_org for update;
  update public.organisations
    set name = btrim(p_name), timezone = p_timezone, fiscal_year_start_month = p_fiscal_month
    where id = p_org;
  perform app.write_audit(p_org, 'organisation.updated', 'organisation', p_org, v_before,
    jsonb_build_object('name', btrim(p_name), 'timezone', p_timezone, 'fiscal_month', p_fiscal_month));
end $$;

create function public.set_organisation_suspended(p_org uuid, p_suspended boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_before text; v_after text;
begin
  perform app.require_platform_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select status into v_before from public.organisations where id = p_org for update;
  if v_before is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_after := case when p_suspended then 'suspended' else 'active' end;
  update public.organisations set status = v_after where id = p_org;
  perform app.write_audit(p_org, 'organisation.status_changed', 'organisation', p_org,
    jsonb_build_object('status', v_before), jsonb_build_object('status', v_after), btrim(p_reason));
end $$;

create function public.my_organisations()
returns table (id uuid, name text, slug text, status text, membership_status text)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name, o.slug, o.status, m.status
  from public.memberships m join public.organisations o on o.id = m.org_id
  where m.user_id = (select auth.uid()) and m.status <> 'left'
  order by o.name
$$;

create function public.my_permissions(p_org uuid)
returns table (permission_key text, scope text, department_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct rp.permission_key, rp.scope, mr.department_id
  from public.membership_roles mr
  join public.roles r on r.id = mr.role_id and r.archived_at is null
  join public.role_permissions rp on rp.role_id = r.id
  where mr.org_id = p_org and mr.membership_id = app.membership_id(p_org)
    and mr.valid_from <= now() and (mr.valid_until is null or mr.valid_until > now())
$$;

create function public.my_profile() returns table (full_name text, phone text)
language sql stable security definer set search_path = '' as $$
  select p.full_name, p.phone from public.profiles p where p.user_id = (select auth.uid())
$$;

-- Support access ------------------------------------------------------------

create function public.start_support_session(p_org uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform app.require_platform_admin();
  update public.support_sessions set ended_at = now()
    where admin_user_id = auth.uid() and org_id = p_org and ended_at is null;
  insert into public.support_sessions (org_id, admin_user_id, reason, expires_at)
    values (p_org, auth.uid(), btrim(p_reason), now() + interval '1 hour') returning id into v_id;
  perform app.write_audit(p_org, 'support.started', 'support_session', v_id, null, null, btrim(p_reason));
  return v_id;
end $$;

create function public.end_support_session(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  perform app.require_platform_admin();
  update public.support_sessions set ended_at = now()
    where id = p_id and admin_user_id = auth.uid() and ended_at is null returning org_id into v_org;
  if v_org is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(v_org, 'support.ended', 'support_session', p_id);
end $$;

-- First superadmin: callable only with the server key. -----------------------

create function public.grant_platform_admin(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.platform_admins (user_id) values (p_user) on conflict do nothing;
  perform app.write_audit(null, 'platform_admin.granted', 'user', p_user);
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_org_invite(text), public.revoke_org_invite(uuid),
  public.accept_org_invite(text, text, text), public.decline_access_request(uuid),
  public.update_organisation(uuid, text, text, smallint),
  public.set_organisation_suspended(uuid, boolean, text),
  public.my_organisations(), public.my_permissions(uuid), public.my_profile(),
  public.start_support_session(uuid, text), public.end_support_session(uuid)
to authenticated;
grant execute on function
  public.peek_org_invite(text), public.submit_access_request(text, text, text, text),
  public.grant_platform_admin(uuid)
to service_role;
