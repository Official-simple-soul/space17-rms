begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(30);

insert into auth.users (id, email, email_confirmed_at, aud, role)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated'
from generate_series(1, 4) n;
create function pg_temp.login(p_n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_n,
    'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;
grant execute on function pg_temp.login(int) to authenticated;
grant usage on schema extensions to authenticated;
create temp table t (k text primary key, v text); grant all on t to authenticated;
create function pg_temp.v(p text) returns uuid language sql as $$ select v::uuid from t where k = p $$;
grant execute on function pg_temp.v(text) to authenticated;

-- 1 admin, 2 may only create requests, 3 approver, 4 auditor.
insert into organisations (name, slug) values ('Org A', 'org-a');
insert into t select 'org', id::text from organisations where slug = 'org-a';
select app.seed_roles(pg_temp.v('org'));
insert into memberships (org_id, user_id) select pg_temp.v('org'), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 4) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id = pg_temp.v('org');
insert into roles (org_id, name) values (pg_temp.v('org'), 'Requester');
insert into role_permissions (org_id, role_id, permission_key, scope)
  select org_id, id, 'requests.create', 'own' from roles where org_id = pg_temp.v('org') and name = 'Requester';
insert into membership_roles (org_id, membership_id, role_id)
  select r.org_id, pg_temp.v(x.m), r.id from (values ('m1', 'Organisation admin'), ('m2', 'Requester'), ('m3', 'Approver'), ('m4', 'Auditor')) x (m, n)
  join roles r on r.org_id = pg_temp.v('org') and r.name = x.n;
insert into departments (org_id, name, code) values (pg_temp.v('org'), 'Mine', 'MIN'), (pg_temp.v('org'), 'Other', 'OTH');
insert into t select code, id::text from departments where org_id = pg_temp.v('org');
insert into department_members (org_id, department_id, membership_id) values
  (pg_temp.v('org'), pg_temp.v('MIN'), pg_temp.v('m2')), (pg_temp.v('org'), pg_temp.v('OTH'), pg_temp.v('m3'));
set local role authenticated;
select pg_temp.login(1);
select add_starter_configuration(pg_temp.v('org'));
insert into t select code, id::text from categories where org_id = pg_temp.v('org');
reset role;
insert into category_departments (org_id, category_id, department_id) values (pg_temp.v('org'), pg_temp.v('EQP'), pg_temp.v('OTH'));
set local role authenticated;

select pg_temp.login(2);
select is((select count(*)::int from memberships), 1, 'only their own membership');
select is((select count(*)::int from profiles), 1, 'only their own name');
select is((select count(*)::int from membership_roles), 1, 'only their own roles');
select is((select count(*)::int from department_members), 1, 'only their own departments');
select is((select string_agg(code, ',') from departments), 'MIN', 'no other department');
select is((select count(*)::int from roles), 0, 'no roles');
select is((select count(*)::int from role_permissions), 0, 'no permissions of roles');
select is((select count(*)::int from templates), 0, 'no templates');
select is((select count(*)::int from template_versions), 0, 'no template versions');
select is((select count(*)::int from workflows), 0, 'no workflows');
select is((select count(*)::int from workflow_steps), 0, 'no workflow steps');
select is((select count(*)::int from category_approvers), 0, 'no approver lists');
select is((select count(*)::int from number_sequences), 0, 'no numbering');
select is((select count(*)::int from categories), 4, 'only categories their departments can use');
select throws_ok($$ select * from list_members(pg_temp.v('org')) $$, '42501', 'not_allowed', 'cannot list people');
select throws_ok($$ select * from department_overview(pg_temp.v('org')) $$, '42501', 'not_allowed', 'cannot list departments');
select throws_ok($$ select * from role_overview(pg_temp.v('org')) $$, '42501', 'not_allowed', 'cannot list roles');
select throws_ok($$ select * from setup_counts(pg_temp.v('org')) $$, '42501', 'not_allowed', 'cannot count');
select throws_ok($$ select * from preview_steps(pg_temp.v('EQP'), 0) $$, 'P0002', 'not_found', 'no steps for a category they cannot use');
select is((select count(*)::int from preview_steps(pg_temp.v('OFF'), 0)), 1, 'steps for a category they can use');
select is((select count(*)::int from requestable_categories(pg_temp.v('org'))), 4, 'can still request');
select is((select count(*)::int from my_permissions(pg_temp.v('org'))), 1, 'can still read their own permissions');

select pg_temp.login(3);
select is((select count(*)::int from memberships), 1, 'an approver cannot list people');
select is((select count(*)::int from departments), 2, 'an approver can filter by department');
select is((select count(*)::int from roles), 0, 'an approver cannot read roles');

select pg_temp.login(4);
select is((select max(total)::int from list_members(pg_temp.v('org'))), 4, 'an auditor can list people');
select is((select count(*)::int from departments), 2, 'an auditor sees departments');

select pg_temp.login(1);
select is((select count(*)::int from memberships), 4, 'an admin sees everyone');
select is((select count(*)::int from workflows), 2, 'an admin sees workflows');
select set_member_status(pg_temp.v('org'), pg_temp.v('m2'), 'suspended', 'Testing access');
select pg_temp.login(2);
select is((select count(*)::int from departments) + (select count(*)::int from categories), 0, 'a suspended person sees nothing');
select * from finish();
rollback;
