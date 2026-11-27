begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select * from no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated',
  jsonb_build_object('full_name', 'User ' || n) from generate_series(1, 5) n;
create function pg_temp.login(p_n int, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_n,
    'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
grant execute on function pg_temp.login(int, text) to authenticated;
grant usage on schema extensions to authenticated;
create temp table t (k text primary key, v text); grant all on t to authenticated;
create function pg_temp.v(p text) returns uuid language sql as $$ select v::uuid from t where k = p $$;
grant execute on function pg_temp.v(text) to authenticated;

insert into organisations (name, slug) values ('Org A', 'org-a'), ('Org B', 'org-b');
insert into t select slug, id::text from organisations where slug in ('org-a', 'org-b');
select app.seed_roles(pg_temp.v('org-a')); select app.seed_roles(pg_temp.v('org-b'));
insert into memberships (org_id, user_id)
  select pg_temp.v(case when n = 5 then 'org-b' else 'org-a' end), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 5) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id in (pg_temp.v('org-a'), pg_temp.v('org-b'));
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org-a');
insert into t select 'b-' || system_key, id::text from roles where org_id = pg_temp.v('org-b');
insert into membership_roles (org_id, membership_id, role_id) values
  (pg_temp.v('org-a'), pg_temp.v('m1'), pg_temp.v('admin')), (pg_temp.v('org-b'), pg_temp.v('m5'), pg_temp.v('b-admin')),
  (pg_temp.v('org-a'), pg_temp.v('m2'), pg_temp.v('approver')), (pg_temp.v('org-a'), pg_temp.v('m4'), pg_temp.v('staff'));
insert into departments (org_id, name, code) values (pg_temp.v('org-a'), 'Finance', 'FIN'), (pg_temp.v('org-a'), 'Field', 'FLD');
insert into t select code, id::text from departments where org_id = pg_temp.v('org-a');

-- Numbering
select is((select count(*)::int from number_sequences where org_id = pg_temp.v('org-a')), 4, 'numbering is ready for a new organisation');
select is(app.next_number(pg_temp.v('org-a'), 'request'), 'REQ-' || to_char(now() at time zone 'Africa/Lagos', 'YYYY') || '-0001', 'first number');
select is(app.next_number(pg_temp.v('org-a'), 'request'), 'REQ-' || to_char(now() at time zone 'Africa/Lagos', 'YYYY') || '-0002', 'next number');
select is(app.next_number(pg_temp.v('org-b'), 'request'), 'REQ-' || to_char(now() at time zone 'Africa/Lagos', 'YYYY') || '-0001', 'organisations count separately');
update number_counters set last_value = 99999 where org_id = pg_temp.v('org-b');
select matches(app.next_number(pg_temp.v('org-b'), 'request'), '-100000$', 'numbers past the padding are not cut');

-- Permission, MFA and isolation
set local role authenticated;
select pg_temp.login(4);
select throws_ok($$ select save_category(pg_temp.v('org-a'), null, 'X1') $$, '42501', 'not_allowed', 'staff cannot configure');
select throws_ok($$ select * from setup_warnings(pg_temp.v('org-a')) $$, '42501', 'not_allowed', 'staff cannot see setup warnings');
select throws_ok($$ select * from list_audit(pg_temp.v('org-a')) $$, '42501', 'not_allowed', 'staff cannot read the audit log');
select throws_ok($$ select * from number_counters $$, '42501', null, 'counters are private');
select throws_ok($$ select app.next_number(pg_temp.v('org-a'), 'request') $$, '42501', null, 'clients cannot use up numbers');
select pg_temp.login(5);
select throws_ok($$ select save_category(pg_temp.v('org-a'), null, 'X1') $$, '42501', 'not_allowed', 'another organisation cannot configure');
select is((select count(*)::int from number_sequences), 4, 'another organisation is invisible');
select pg_temp.login(1, 'aal1');
select throws_ok($$ select save_numbering(pg_temp.v('org-a'), 'request', 'RQ', 'year', 4::smallint) $$, '42501', 'mfa_required', 'configuration needs MFA');
select pg_temp.login(1);
select lives_ok($$ select save_numbering(pg_temp.v('org-a'), 'request', 'rq', 'never', 5::smallint) $$, 'numbering changes');
select throws_ok($$ select save_numbering(pg_temp.v('org-a'), 'report', 'RQ', 'year', 4::smallint) $$, '23505', null, 'prefixes are unique');
reset role;
select is(app.next_number(pg_temp.v('org-a'), 'request'), 'RQ-00001', 'new format applies');
set local role authenticated;

-- Categories are labels
insert into t select 'cat', save_category(pg_temp.v('org-a'), null, ' Travel ')::text;
select is((select name from categories where id = pg_temp.v('cat')), 'Travel', 'names are tidied');
select throws_ok($$ select save_category(pg_temp.v('org-a'), null, 'travel') $$, '22023', 'category_exists', 'names are unique, whatever the case');
select throws_ok($$ select save_category(pg_temp.v('org-a'), null, 'T') $$, '22023', 'invalid_name', 'names are not too short');
select lives_ok($$ select save_category(pg_temp.v('org-a'), pg_temp.v('cat'), 'Travel') $$, 'saving the same name is fine');
select lives_ok($$ select save_category(pg_temp.v('org-a'), pg_temp.v('cat'), 'Travel and transport') $$, 'renames');
select throws_ok($$ select save_role(pg_temp.v('org-a'), null, 'Lead', '[{"key":"requests.approve","scope":"category"}]') $$, '22023', 'invalid_permissions', 'approval is by department, not category');

-- Setup warnings: each department needs two people who can approve, as nobody approves their own request.
select is((select array_agg(code || ':' || found || '/' || needed order by code, subject) from setup_warnings(pg_temp.v('org-a'))),
  array['department_approvers:1/2', 'department_approvers:1/2', 'department_head:0/1', 'department_head:0/1', 'payers:0/2'], 'setup warnings');
select grant_role(pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('approver'), pg_temp.v('FLD'));
select is((select string_agg(subject, ',') from setup_warnings(pg_temp.v('org-a')) where code = 'department_approvers'), 'Finance', 'an approver for Field covers Field');
select set_member_status(pg_temp.v('org-a'), pg_temp.v('m3'), 'left', 'Resigned');
select is((select count(*)::int from setup_warnings(pg_temp.v('org-a')) where code = 'department_approvers'), 2, 'leavers stop counting');
select throws_ok($$ select add_starter_configuration(pg_temp.v('org-a')) $$, '22023', 'already_configured', 'the starter set never overwrites');
-- Audit
select is((select max(total)::int from list_audit(pg_temp.v('org-a'), 'travel updated')), 2, 'audit search');
select is((select count(*)::int from list_audit(pg_temp.v('org-a'), p_from => (now() at time zone 'Africa/Lagos')::date + 1)), 0, 'audit date filter');
select is((select count(*)::int from list_audit(pg_temp.v('org-a'), p_person => '00000000-0000-0000-0000-000000000004')), 0, 'audit person filter');

select pg_temp.login(5);
select lives_ok($$ select add_starter_configuration(pg_temp.v('org-b')) $$, 'an empty organisation can use the starter set');
select is((select count(*)::int from categories where org_id = pg_temp.v('org-b')), 7, 'it adds simple category labels');
select * from finish();
rollback;
