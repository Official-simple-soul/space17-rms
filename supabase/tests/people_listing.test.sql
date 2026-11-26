begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);
create temp table t (k text primary key, v uuid); grant all on t to authenticated;
grant usage on schema extensions to authenticated;
insert into organisations (name, slug) values ('Big Org', 'big-org'), ('Other', 'other-org');
insert into t select slug, id from organisations where slug in ('big-org', 'other-org');
create function pg_temp.o(p text) returns uuid language sql as $$ select v from t where k = p $$;
grant execute on function pg_temp.o(text) to authenticated;
select app.seed_roles(pg_temp.o('big-org'));
insert into t select 'staff', id from roles where org_id = pg_temp.o('big-org') and system_key = 'staff';
insert into departments (org_id, name, code) values (pg_temp.o('big-org'), 'Finance', 'FIN');
insert into t select 'fin', id from departments where org_id = pg_temp.o('big-org');
-- More people than the API's 1,000-row limit.
insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
  select gen_random_uuid(), 'bulk' || n || '@test.local', now(), 'authenticated', 'authenticated',
    jsonb_build_object('full_name', 'Person ' || lpad(n::text, 4, '0') || case when n = 7 then ' 100%' else '' end)
  from generate_series(1, 1200) n;
insert into memberships (org_id, user_id) select pg_temp.o('big-org'), id from auth.users where email like 'bulk%@test.local';
insert into department_members (org_id, department_id, membership_id)
  select m.org_id, pg_temp.o('fin'), m.id from memberships m join profiles p on p.user_id = m.user_id
  where m.org_id = pg_temp.o('big-org') and p.full_name <= 'Person 0005';
insert into membership_roles (org_id, membership_id, role_id)
  select org_id, id, pg_temp.o('staff') from memberships where org_id = pg_temp.o('big-org') limit 3;
insert into membership_roles (org_id, membership_id, role_id)
  select m.org_id, m.id, r.id from memberships m join profiles p on p.user_id = m.user_id and p.full_name = 'Person 0001'
  join roles r on r.org_id = m.org_id and r.system_key = 'admin';
update memberships set status = 'left' where user_id = (select user_id from profiles where full_name = 'Person 1200');
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from profiles where full_name = 'Person 0001'), 'role', 'authenticated', 'aal', 'aal1')::text, true);
set local role authenticated;

select is((select max(total)::int from list_members(pg_temp.o('big-org'))), 1199, 'total covers everyone, without leavers');
select is((select count(*)::int from list_members(pg_temp.o('big-org'))), 20, 'a page holds 20');
select is((select name from list_members(pg_temp.o('big-org'), p_offset => 1180) order by name desc limit 1), 'Person 1199', 'the last page is reachable');
select is((select count(*)::int from list_members(pg_temp.o('big-org'), p_limit => 100000)), 100, 'page size is capped');
select is((select count(*)::int from (
  select id from list_members(pg_temp.o('big-org'), p_sort => 'status', p_limit => 100)
  intersect select id from list_members(pg_temp.o('big-org'), p_sort => 'status', p_limit => 100, p_offset => 100)) x), 0, 'pages do not overlap when sort values tie');
select is((select name from list_members(pg_temp.o('big-org'), p_desc => true) limit 1), 'Person 1199', 'descending sort');
select is((select max(total)::int from list_members(pg_temp.o('big-org'), '100%')), 1, 'percent is searched literally');
select is((select max(total)::int from list_members(pg_temp.o('big-org'), 'finance 0003')), 1, 'search needs every word, including departments');
select is((select max(total)::int from list_members(pg_temp.o('big-org'), p_department => pg_temp.o('fin'))), 5, 'department filter');
select is((select max(total)::int from list_members(pg_temp.o('big-org'), p_role => pg_temp.o('staff'))), 3, 'role filter');
select is((select people::int from department_overview(pg_temp.o('big-org'))), 5, 'department count');
select throws_ok($$ select * from list_members(pg_temp.o('other-org')) $$, '42501', 'not_allowed', 'other organisations are refused');
select * from finish();
rollback;
