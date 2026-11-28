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
insert into departments (org_id, name, code, created_at) values (pg_temp.v('org'), 'Office', 'OFC', now() - interval '1 year');
insert into t select 'OFC', id::text from departments where org_id = pg_temp.v('org') and code = 'OFC';
insert into t select 'month', (date_trunc('month', pg_temp.today()) - interval '1 month')::date::text;
create function pg_temp.month() returns date language sql as $$ select v::date from t where k = 'month' $$;
create function pg_temp.rlock(p text) returns int language sql as $$ select (get_report(pg_temp.v(p)) ->> 'lock_version')::int $$;
grant execute on function pg_temp.month(), pg_temp.rlock(text) to authenticated;

create function pg_temp.spend(p_key text, p_date date) returns void language plpgsql as $$
begin
  perform pg_temp.login(4);
  insert into t select p_key, save_expense(pg_temp.v('org'), null, pg_temp.v('cat'), pg_temp.v('FLD'), null, p_date,
    'Printer ink', 'Office Mart', null, null, 'department', true, 'Lost it',
    '[{"description":"Ink","quantity":1,"unit_price_minor":500000}]', null) ->> 'id';
  perform submit_expense(pg_temp.v(p_key), 1);
  perform pg_temp.login(2);
  perform decide_expense(pg_temp.v(p_key), pg_temp.lock(p_key), 'accept', null);
end $$;
grant execute on function pg_temp.spend(text, date) to authenticated;
set local role authenticated;

-- Last month: Field spent and reported; Office spent nothing.
select pg_temp.spend('ink', pg_temp.month() + 3);
insert into t select 'rep', get_expense(pg_temp.v('ink')) #>> '{report,id}';
select is((get_report(pg_temp.v('rep')) ->> 'month')::date, pg_temp.month(), 'the expense is in last month''s report');
select pg_temp.login(2);
select submit_report(pg_temp.v('rep'), pg_temp.rlock('rep'), true);

select pg_temp.login(4);
select throws_ok($$ select * from month_checklist(pg_temp.v('org'), pg_temp.month()) $$, '42501', 'not_allowed', 'staff cannot see the checklist');
select pg_temp.login(3);
select is((select string_agg(department || ':' || status, ',' order by department) from month_checklist(pg_temp.v('org'), pg_temp.month())),
  'Field:under_review,Office:missing', 'finance sees each department');
select throws_ok($$ select close_period(pg_temp.v('org'), pg_temp.month()) $$, '22023', 'reports_outstanding', 'it cannot close with reports outstanding');
select throws_ok($$ select close_period(pg_temp.v('org'), date_trunc('month', pg_temp.today())::date) $$, '22023', 'invalid_month', 'nor close the current month');
select review_report(pg_temp.v('rep'), pg_temp.rlock('rep'), 'approve', 'Receipt lost, confirmed with the head');
select throws_ok($$ select waive_report(pg_temp.v('org'), pg_temp.v('FLD'), pg_temp.month(), 'Nothing spent') $$, '22023', 'cannot_waive', 'a report with expenses is not waived');
select throws_ok($$ select waive_report(pg_temp.v('org'), pg_temp.v('OFC'), pg_temp.month(), 'no') $$, '22023', 'reason_required', 'waiving needs a reason');
select lives_ok($$ select waive_report(pg_temp.v('org'), pg_temp.v('OFC'), pg_temp.month(), 'Nothing spent this month') $$, 'office is excused');
select is((select settled from list_periods(pg_temp.v('org')) where month = pg_temp.month()), 2::bigint, 'both are settled');
select lives_ok($$ select close_period(pg_temp.v('org'), pg_temp.month()) $$, 'the month closes');
select is((select status from list_periods(pg_temp.v('org')) where month = pg_temp.month()), 'closed', 'closed');
select is(get_expense(pg_temp.v('ink')) ->> 'status', 'locked', 'its lines are locked');
select ok((get_report(pg_temp.v('rep')) ->> 'period_closed')::boolean, 'the report says so');
select throws_ok($$ select close_period(pg_temp.v('org'), pg_temp.month()) $$, '22023', 'period_closed', 'it closes once');
select throws_ok($$ select waive_report(pg_temp.v('org'), pg_temp.v('OFC'), pg_temp.month(), 'Again please') $$, '22023', 'period_closed', 'nothing more is waived');

-- A late expense from the closed month goes into an open one instead.
select pg_temp.spend('late', pg_temp.month() + 5);
select ok((get_report((get_expense(pg_temp.v('late')) #>> '{report,id}')::uuid) ->> 'month')::date > pg_temp.month(), 'late spending goes to an open month');

-- Corrections after approval: proposed by one person, decided by another.
select pg_temp.login(2);
select throws_ok($$ select propose_adjustment(pg_temp.v('rep'), -100000, 'Refund from Office Mart') $$, '42501', 'not_allowed', 'heads do not adjust');
select pg_temp.login(3);
select throws_ok($$ select propose_adjustment(pg_temp.v('rep'), 0, 'Refund from Office Mart') $$, '22023', 'invalid_amounts', 'an adjustment changes something');
insert into t select 'adj', propose_adjustment(pg_temp.v('rep'), -100000, 'Refund from Office Mart')::text;
select ok(not (get_report(pg_temp.v('rep')) #>> '{adjustments,0,can_decide}')::boolean, 'the proposer cannot approve it');
select throws_ok($$ select decide_adjustment(pg_temp.v('adj'), true) $$, '42501', 'own_adjustment', 'even directly');
select is((get_report(pg_temp.v('rep')) ->> 'adjusted_minor')::bigint, 0::bigint, 'nothing counts until approved');
select pg_temp.login(5);
select throws_ok($$ select decide_adjustment(pg_temp.v('adj'), false, 'no') $$, '22023', 'reason_required', 'rejecting needs a reason');
select lives_ok($$ select decide_adjustment(pg_temp.v('adj'), true, null) $$, 'a second person approves');
select is((get_report(pg_temp.v('rep')) ->> 'adjusted_minor')::bigint, -100000::bigint, 'and it counts');
select throws_ok($$ select decide_adjustment(pg_temp.v('adj'), false, 'Changed my mind') $$, 'P0002', 'not_found', 'a decision is final');

-- Reopening needs a reason; approved work stays approved.
select pg_temp.login(3);
select throws_ok($$ select reopen_period(pg_temp.v('org'), pg_temp.month(), 'no') $$, '22023', 'reason_required', 'reopening needs a reason');
select lives_ok($$ select reopen_period(pg_temp.v('org'), pg_temp.month(), 'Office found a receipt') $$, 'finance reopens it');
select is(get_report(pg_temp.v('rep')) ->> 'status', 'approved', 'approved reports stay approved');
select is(get_expense(pg_temp.v('ink')) ->> 'status', 'locked', 'and their lines stay locked');
reset role;
select throws_ok($$ delete from period_events $$, '42501', null, 'the history of closing cannot change');
select * from finish();
rollback;
