begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(28);

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'root@test.local', now(), 'authenticated', 'authenticated');
select public.grant_platform_admin('00000000-0000-0000-0000-00000000000c');

create function pg_temp.login(p_user text, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
grant execute on function pg_temp.login(text, text) to authenticated;
grant usage on schema extensions to authenticated, anon;
create temp table t (k text primary key, v text);
grant all on t to authenticated, anon;

select is((select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0, 'RLS is on for every public table');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'), 0, 'anon has no table grants');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute no public function');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public'
  and grantee = 'authenticated' and privilege_type in ('INSERT', 'DELETE', 'TRUNCATE')), 0, 'clients cannot insert or delete directly');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app','public') and p.prosecdef and not (coalesce(p.proconfig, '{}') @> array['search_path=""'])), 0, 'definer functions pin search_path');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'aal1');
select throws_ok($$ select public.create_org_invite('a@test.local') $$, '42501', 'mfa_required', 'superadmin needs MFA');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'aal2');
select throws_ok($$ select public.create_org_invite('a@test.local') $$, '42501', 'not_allowed', 'ordinary users cannot invite organisations');
select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'aal2');
insert into t select 'ta', public.create_org_invite('a@test.local');
insert into t select 'tb', public.create_org_invite('B@test.local');
select throws_ok($$ select token_hash from public.org_invites $$, '42501', null, 'token hashes are unreadable');

select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'aal1');
select throws_ok($$ select public.accept_org_invite((select v from t where k = 'ta'), 'Stolen', 'stolen') $$, '42501', 'invite_email_mismatch', 'invite is locked to its email');
select lives_ok($$ select public.accept_org_invite((select v from t where k = 'tb'), 'Org B', 'org-b') $$, 'B accepts');
select throws_ok($$ select public.accept_org_invite((select v from t where k = 'tb'), 'Again', 'again') $$, '22023', 'invite_invalid', 'invite is single use');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'aal1');
select lives_ok($$ select public.accept_org_invite((select v from t where k = 'ta'), 'Org A', 'org-a') $$, 'A accepts');

select is((select count(*)::int from public.organisations), 1, 'A sees one organisation');
select is((select count(*)::int from public.memberships), 1, 'A sees only its memberships');
select is((select count(*)::int from public.roles), 6, 'A sees only its roles');
select is((select count(*)::int from public.profiles), 1, 'A sees no foreign profiles');
select is((select count(*)::int from public.audit_logs where action = 'organisation.created'), 1, 'A sees only its audit');
select throws_ok($$ select public.update_organisation((select id from public.organisations), 'Org A', 'Africa/Lagos', 1::smallint) $$, '42501', 'mfa_required', 'admin changes need MFA');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'aal2');
select lives_ok($$ select public.update_organisation((select id from public.organisations), 'Org A2', 'Africa/Lagos', 4::smallint) $$, 'admin with MFA can update');

reset role;
insert into t select 'orgb', id::text from public.organisations where slug = 'org-b';
insert into t select 'orga', id::text from public.organisations where slug = 'org-a';
select throws_ok($$ insert into public.membership_roles (org_id, membership_id, role_id)
  select m.org_id, m.id, (select r.id from public.roles r where r.org_id = (select v::uuid from t where k = 'orgb') limit 1)
  from public.memberships m where m.org_id = (select v::uuid from t where k = 'orga') $$, '23503', null, 'cross-organisation references fail');
select throws_ok($$ update public.audit_logs set action = 'x' $$, '42501', null, 'audit cannot change even for the owner');

set local role authenticated;
select throws_ok($$ select public.update_organisation((select v::uuid from t where k = 'orgb'), 'Hacked', 'Africa/Lagos', 1::smallint) $$, '42501', 'not_allowed', 'A cannot update B');

select pg_temp.login('00000000-0000-0000-0000-00000000000c', 'aal2');
select is((select count(*)::int from public.memberships), 0, 'superadmin sees no members by default');
insert into t select 's', public.start_support_session((select v::uuid from t where k = 'orgb'), 'Investigating an issue')::text;
select is((select count(*)::int from public.memberships), 1, 'support access shows one organisation');
select throws_ok($$ select public.update_organisation((select v::uuid from t where k = 'orgb'), 'Hacked', 'Africa/Lagos', 1::smallint) $$, '42501', 'not_allowed', 'support access is read-only');
reset role;
update public.support_sessions set starts_at = now() - interval '2 hours', expires_at = now() - interval '1 hour';
set local role authenticated;
select is((select count(*)::int from public.memberships), 0, 'expired support access stops');
select lives_ok($$ select public.set_organisation_suspended((select v::uuid from t where k = 'orga'), true, 'Test suspension') $$, 'superadmin suspends A');
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'aal2');
select is((select count(*)::int from public.organisations), 0, 'suspended organisation is unreadable');

select * from finish();
rollback;
