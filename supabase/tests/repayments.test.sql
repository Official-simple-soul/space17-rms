begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select * from no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated',
  jsonb_build_object('full_name', 'User ' || n) from generate_series(1, 5) n;
create function pg_temp.login(p_n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_n,
    'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;
grant execute on function pg_temp.login(int) to authenticated;
create temp table t (k text primary key, v text); grant all on t to authenticated;
create function pg_temp.v(p text) returns uuid language sql as $$ select v::uuid from t where k = p $$;
create function pg_temp.lock(p text) returns int language sql as $$ select (get_expense(pg_temp.v(p)) ->> 'lock_version')::int $$;
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Africa/Lagos')::date $$;
grant execute on function pg_temp.v(text), pg_temp.lock(text), pg_temp.today() to authenticated;

-- 1 admin, 2 head of Field, 3 finance, 4 staff in Field, 5 second finance
insert into organisations (name, slug) values ('Org A', 'org-a');
insert into t select 'org', id::text from organisations where slug = 'org-a';
select app.seed_roles(pg_temp.v('org'));
insert into memberships (org_id, user_id) select pg_temp.v('org'), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 5) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id = pg_temp.v('org');
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org');
insert into departments (org_id, name, code, created_at) values (pg_temp.v('org'), 'Field', 'FLD', now() - interval '1 year');
insert into t select code, id::text from departments where org_id = pg_temp.v('org');
insert into categories (org_id, name) values (pg_temp.v('org'), 'Supplies');
insert into t select 'cat', id::text from categories where org_id = pg_temp.v('org');
insert into membership_roles (org_id, membership_id, role_id, department_id) values
  (pg_temp.v('org'), pg_temp.v('m1'), pg_temp.v('admin'), null), (pg_temp.v('org'), pg_temp.v('m2'), pg_temp.v('hod'), pg_temp.v('FLD')),
  (pg_temp.v('org'), pg_temp.v('m3'), pg_temp.v('finance'), null), (pg_temp.v('org'), pg_temp.v('m4'), pg_temp.v('staff'), null),
  (pg_temp.v('org'), pg_temp.v('m5'), pg_temp.v('finance'), null);
insert into department_members (org_id, department_id, membership_id)
  select pg_temp.v('org'), pg_temp.v('FLD'), pg_temp.v(m) from unnest(array['m2', 'm3', 'm4']) m;

create function pg_temp.spend(p_key text, p_user int, p_funding text) returns void language plpgsql as $$
begin
  perform pg_temp.login(p_user);
  insert into t select p_key, save_expense(pg_temp.v('org'), null, pg_temp.v('cat'), pg_temp.v('FLD'), null, pg_temp.today(),
    'Bus fare', 'Danfo driver', 'Wuse', null, p_funding, true, 'Drivers give no receipt',
    '[{"description":"Fare","quantity":1,"unit_price_minor":300000}]', null) ->> 'id';
  perform submit_expense(pg_temp.v(p_key), 1);
end $$;
grant execute on function pg_temp.spend(text, int, text) to authenticated;
set local role authenticated;

select pg_temp.spend('own', 4, 'personal');
select pg_temp.spend('dept', 4, 'department');
select pg_temp.login(3);
select is((select count(*)::int from list_repayable(pg_temp.v('org'))), 0, 'nothing is owed before the head accepts');
select pg_temp.login(2);
select decide_expense(pg_temp.v('own'), pg_temp.lock('own'), 'accept', null);
select decide_expense(pg_temp.v('dept'), pg_temp.lock('dept'), 'accept', null);

select pg_temp.login(4);
select throws_ok($$ select * from list_repayable(pg_temp.v('org')) $$, '42501', 'not_allowed', 'staff cannot see the queue');
select ok(not (get_expense(pg_temp.v('own')) #>> '{repayment,can_pay}')::boolean, 'nor repay themselves');
select pg_temp.login(3);
select is((select string_agg(description, ',') from list_repayable(pg_temp.v('org'))), 'Bus fare', 'only personal money is owed');
select is((select to_pay from my_work(pg_temp.v('org'))), 1::bigint, 'and counted as a payment due');
select throws_ok($$ select record_repayment(pg_temp.v('dept'), pg_temp.lock('dept'), 100, pg_temp.today(), 'cash', null, null) $$,
  '22023', 'not_payable', 'department money is not repaid');
select throws_ok($$ select record_repayment(pg_temp.v('own'), pg_temp.lock('own'), 300001, pg_temp.today(), 'cash', null, null) $$,
  '22023', 'overpayment', 'never more than was spent');
select throws_ok($$ select record_repayment(pg_temp.v('own'), 1, 100, pg_temp.today(), 'cash', null, null) $$,
  '22023', 'stale_expense', 'an outdated page cannot pay');
insert into t select 'p1', record_repayment(pg_temp.v('own'), pg_temp.lock('own'), 100000, pg_temp.today(), 'bank_transfer', 'TRX1', null)::text;
select is((get_expense(pg_temp.v('own')) #>> '{repayment,repaid_minor}')::bigint, 100000::bigint, 'part is repaid');
insert into t select 'p2', record_repayment(pg_temp.v('own'), pg_temp.lock('own'), 200000, pg_temp.today(), 'cash', null, 'In person')::text;
select is((select count(*)::int from list_repayable(pg_temp.v('org'))), 0, 'repaid in full leaves the queue');
select is((select count(*)::int from list_payments(pg_temp.v('org')) where expense_id = pg_temp.v('own')), 2, 'both appear in payment history');
select throws_ok($$ select record_repayment(pg_temp.v('own'), pg_temp.lock('own'), 1, pg_temp.today(), 'cash', null, null) $$,
  '22023', 'not_payable', 'nothing more is owed');

select pg_temp.login(4);
select ok(exists (select 1 from list_notifications(pg_temp.v('org')) n where n.type = 'repayment_recorded' and n.expense_id = pg_temp.v('own')), 'the person is told');
select is((select to_confirm from my_work(pg_temp.v('org'))), 2::bigint, 'and asked to confirm');
select lives_ok($$ select confirm_repayment(pg_temp.v('p1')) $$, 'they confirm one');
select is((select to_confirm from my_work(pg_temp.v('org'))), 1::bigint, 'one left to confirm');
select pg_temp.login(2);
select throws_ok($$ select confirm_repayment(pg_temp.v('p2')) $$, 'P0002', 'not_found', 'only the person paid confirms');

select pg_temp.login(5);
select throws_ok($$ select void_repayment(pg_temp.v('p1'), pg_temp.lock('own'), 'Wrong amount') $$, '22023', 'void_closed', 'a confirmed payment stays');
select throws_ok($$ select void_repayment(pg_temp.v('p2'), pg_temp.lock('own'), 'no') $$, '22023', 'reason_required', 'voiding needs a reason');
select lives_ok($$ select void_repayment(pg_temp.v('p2'), pg_temp.lock('own'), 'Paid twice by mistake') $$, 'a second finance person voids it');
select is((get_expense(pg_temp.v('own')) #>> '{repayment,repaid_minor}')::bigint, 100000::bigint, 'the balance is owed again');
select is((select count(*)::int from list_repayable(pg_temp.v('org'))), 1, 'and back in the queue');
select pg_temp.login(4);
select throws_ok($$ select * from repayment_account(pg_temp.v('own')) $$, '42501', 'not_allowed', 'the person repaid cannot look up details this way');
select pg_temp.login(3);
select is((select count(*)::int from repayment_account(pg_temp.v('own'))), 0, 'no details added yet');
select throws_ok($$ select reveal_repayment_account(pg_temp.v('own')) $$, 'P0002', 'not_found', 'nothing to reveal');
select * from finish();
rollback;
