begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(28);

insert into auth.users (id, email, email_confirmed_at, aud, role)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated'
from generate_series(1, 4) n;
create function pg_temp.login(p_n int, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_n,
    'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
grant execute on function pg_temp.login(int, text) to authenticated;
grant usage on schema extensions to authenticated;
create temp table t (k text primary key, v text);
grant all on t to authenticated;
create function pg_temp.v(p text) returns uuid language sql as $$ select v::uuid from t where k = p $$;
grant execute on function pg_temp.v(text) to authenticated;

-- Two organisations, each with one admin (users 1 and 4).
insert into organisations (name, slug) values ('Org A', 'org-a'), ('Org B', 'org-b');
insert into t select slug, id::text from organisations where slug in ('org-a', 'org-b');
select app.seed_roles(pg_temp.v('org-a')); select app.seed_roles(pg_temp.v('org-b'));
insert into memberships (org_id, user_id) values
  (pg_temp.v('org-a'), '00000000-0000-0000-0000-000000000001'), (pg_temp.v('org-b'), '00000000-0000-0000-0000-000000000004');
insert into membership_roles (org_id, membership_id, role_id)
  select m.org_id, m.id, r.id from memberships m join roles r on r.org_id = m.org_id and r.system_key = 'admin'
  where m.org_id in (pg_temp.v('org-a'), pg_temp.v('org-b'));
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org-a');
insert into t select 'm1', id::text from memberships where org_id = pg_temp.v('org-a');
insert into t select 'b-role', id::text from roles where org_id = pg_temp.v('org-b') and system_key = 'staff';

set local role authenticated;
select pg_temp.login(1, 'aal1');
select throws_ok($$ select save_department(pg_temp.v('org-a'), null, 'Sales', 'SAL', null) $$, '42501', 'mfa_required', 'department changes need MFA');
select pg_temp.login(4);
select throws_ok($$ select save_department(pg_temp.v('org-a'), null, 'Sales', 'SAL', null) $$, '42501', 'not_allowed', 'another organisation cannot add departments');
select pg_temp.login(1);
insert into t select 'd1', save_department(pg_temp.v('org-a'), null, 'Sales', 'sal', null)::text;
insert into t select 'd2', save_department(pg_temp.v('org-a'), null, 'Field', 'FLD', pg_temp.v('d1'))::text;
select throws_ok($$ select save_department(pg_temp.v('org-a'), pg_temp.v('d1'), 'Sales', 'SAL', pg_temp.v('d2')) $$, '22023', 'department_cycle', 'departments cannot loop');
select throws_ok($$ select archive_department(pg_temp.v('org-a'), pg_temp.v('d1')) $$, '22023', 'department_in_use', 'a parent cannot be archived');
select throws_ok($$ select invite_member(pg_temp.v('org-a'), 'u2@test.local', pg_temp.v('hod'), null) $$, '22023', 'department_required', 'HOD invitations need a department');
select throws_ok($$ select invite_member(pg_temp.v('org-a'), 'u2@test.local', pg_temp.v('b-role'), null) $$, 'P0002', 'not_found', 'roles from another organisation are refused');
insert into t select 'i2', invite_member(pg_temp.v('org-a'), 'U2@test.local', pg_temp.v('hod'), pg_temp.v('d1'));
insert into t select 'i3', invite_member(pg_temp.v('org-a'), 'u3@test.local', pg_temp.v('staff'), null);
select throws_ok($$ select token_hash from invitations $$, '42501', null, 'invitation hashes are unreadable');
select pg_temp.login(3);
select throws_ok($$ select accept_invitation((select v from t where k = 'i2')) $$, '42501', 'invite_email_mismatch', 'invitation is email-locked');
select lives_ok($$ select accept_invitation((select v from t where k = 'i3')) $$, 'staff joins');
select throws_ok($$ select accept_invitation((select v from t where k = 'i3')) $$, '22023', 'invite_invalid', 'invitation is single use');
select is((select count(*)::int from invitations), 0, 'staff cannot read invitations');
select throws_ok($$ select invite_member(pg_temp.v('org-a'), 'x@test.local', pg_temp.v('staff'), null) $$, '42501', 'not_allowed', 'staff cannot invite');
select pg_temp.login(2);
select lives_ok($$ select accept_invitation((select v from t where k = 'i2')) $$, 'HOD joins');
select is((select count(*)::int from memberships where org_id = pg_temp.v('org-a')), 1, 'a head sees only their own membership');
select ok(app.has_perm(pg_temp.v('org-a'), 'reports.submit', pg_temp.v('d1')), 'HOD can submit for own department');
select ok(not app.has_perm(pg_temp.v('org-a'), 'reports.submit', pg_temp.v('d2')), 'HOD cannot submit for another department');

reset role;
insert into t select 'm3', id::text from memberships where user_id = '00000000-0000-0000-0000-000000000003';
insert into t select 'g1', id::text from membership_roles where membership_id = pg_temp.v('m1');
set local role authenticated;
select pg_temp.login(1);
select throws_ok($$ select grant_role(pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('hod'), pg_temp.v('d1')) $$, '22023', 'hod_exists', 'one HOD per department');
select lives_ok($$ select grant_role(pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('hod'), pg_temp.v('d1'), now() + interval '3 days') $$, 'a temporary deputy is allowed');
select pg_temp.login(3);
select ok(app.has_perm(pg_temp.v('org-a'), 'reports.submit', pg_temp.v('d1')), 'deputy has access while active');
reset role;
update membership_roles set valid_from = now() - interval '2 days', valid_until = now() - interval '1 day'
  where membership_id = pg_temp.v('m3') and valid_until is not null;
set local role authenticated;
select ok(not app.has_perm(pg_temp.v('org-a'), 'reports.submit', pg_temp.v('d1')), 'deputy access expires');

select pg_temp.login(1);
select throws_ok($$ select revoke_role(pg_temp.v('org-a'), pg_temp.v('g1')) $$, '42501', 'last_admin', 'last admin cannot be removed');
select throws_ok($$ select save_role(pg_temp.v('org-a'), pg_temp.v('admin'), 'Admin', '[]') $$, '42501', 'admin_role_locked', 'admin role is locked');
select throws_ok($$ select save_role(pg_temp.v('org-a'), null, 'Mixed', '[{"key":"reports.submit","scope":"department"},{"key":"audit.view","scope":"org"}]') $$, '22023', 'mixed_scopes', 'scopes cannot mix');

-- A people manager without role management cannot hand out or remove administration.
insert into t select 'hr', save_role(pg_temp.v('org-a'), null, 'HR', '[{"key":"members.manage","scope":"org"}]')::text;
select grant_role(pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('hr'));
select pg_temp.login(3);
select throws_ok($$ select grant_role(pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('admin')) $$, '42501', 'not_allowed', 'people managers cannot make themselves admin');
select throws_ok($$ select grant_role(pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('finance')) $$, '42501', 'not_allowed', 'people managers cannot raise their own access');
select throws_ok($$ select set_member_status(pg_temp.v('org-a'), pg_temp.v('m1'), 'suspended', 'Taking over') $$, '42501', 'not_allowed', 'people managers cannot suspend an admin');

select pg_temp.login(1);
select set_member_status(pg_temp.v('org-a'), pg_temp.v('m3'), 'left', 'Resigned');
select pg_temp.login(3);
select is((select count(*)::int from memberships where org_id = pg_temp.v('org-a')), 0, 'a leaver sees nothing');
select ok(not app.has_perm(pg_temp.v('org-a'), 'members.manage'), 'a leaver loses permissions');
select * from finish();
rollback;
