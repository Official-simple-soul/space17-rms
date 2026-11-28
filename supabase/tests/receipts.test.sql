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
create temp table t (k text primary key, v text); grant all on t to authenticated, service_role, anon;
create function pg_temp.v(p text) returns uuid language sql as $$ select v::uuid from t where k = p $$;
create function pg_temp.lock(p text) returns int language sql as $$ select (get_expense(pg_temp.v(p)) ->> 'lock_version')::int $$;
create function pg_temp.today() returns date language sql as $$ select (now() at time zone 'Africa/Lagos')::date $$;
grant execute on function pg_temp.v(text), pg_temp.lock(text), pg_temp.today() to authenticated, service_role, anon;

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

-- A purchase from a market seller with no receipt, in Field's report.
select pg_temp.spend('soap', 4, 'department');
select pg_temp.login(2);
select decide_expense(pg_temp.v('soap'), pg_temp.lock('soap'), 'accept', null);
insert into t select 'rep', get_expense(pg_temp.v('soap')) #>> '{report,id}';
select pg_temp.login(3);
select ok(not (get_expense(pg_temp.v('soap')) ->> 'can_issue_receipt')::boolean, 'not before the report reaches Finance');
select throws_ok($$ select issue_internal_receipt(pg_temp.v('soap'), pg_temp.lock('soap'), null) $$, '22023', 'cannot_issue', 'and refused');
select pg_temp.login(2);
select submit_report(pg_temp.v('rep'), (get_report(pg_temp.v('rep')) ->> 'lock_version')::int, true);

select pg_temp.login(4);
select throws_ok($$ select issue_internal_receipt(pg_temp.v('soap'), pg_temp.lock('soap'), null) $$, '42501', 'not_allowed', 'staff cannot issue');
select pg_temp.login(3);
select ok((get_expense(pg_temp.v('soap')) ->> 'can_issue_receipt')::boolean, 'finance can issue');
select throws_ok($$ select issue_internal_receipt(pg_temp.v('soap'), 1, null) $$, '22023', 'stale_expense', 'an outdated page cannot issue');
insert into t select 'r1', issue_internal_receipt(pg_temp.v('soap'), pg_temp.lock('soap'), 'Bus fare to Wuse market')::text;
select matches(get_internal_receipt(pg_temp.v('r1')) ->> 'number', '^CPR-', 'numbered as a Cash Purchase Receipt');
select is(get_internal_receipt(pg_temp.v('r1')) ->> 'issuer', 'Org A', 'the organisation is the issuer');
select is(get_internal_receipt(pg_temp.v('r1')) ->> 'seller', 'Danfo driver', 'with the real seller');
select ok(get_internal_receipt(pg_temp.v('r1')) -> 'phone' = 'null'::jsonb, 'and no phone unless one was typed');
select is(get_internal_receipt(pg_temp.v('r1')) ->> 'description', 'Bus fare to Wuse market', 'a clearer description can be given');
select is((get_internal_receipt(pg_temp.v('r1')) ->> 'total_minor')::bigint, 300000::bigint, 'amounts are as entered');
select is(get_expense(pg_temp.v('soap')) ->> 'evidence', 'internal_receipt', 'it now counts as evidence');
select ok(not (get_expense(pg_temp.v('soap')) -> 'flags' @> '["missing_receipt"]'), 'and is no longer flagged');
select throws_ok($$ select issue_internal_receipt(pg_temp.v('soap'), pg_temp.lock('soap'), null) $$, '22023', 'cannot_issue', 'one at a time');
select pg_temp.login(4);
select ok(exists (select 1 from list_notifications(pg_temp.v('org')) n where n.type = 'receipt_issued'), 'the person who entered it is told');
select is(get_internal_receipt(pg_temp.v('r1')) ->> 'status', 'issued', 'and can see it');

-- The public check shows only what proves it is genuine.
reset role;
insert into t select 'token', verify_token from internal_receipts where id = pg_temp.v('r1');
set local role service_role;
select is(verify_internal_receipt((select v from t where k = 'token')) ->> 'status', 'issued', 'the QR code checks it');
select ok(not (verify_internal_receipt((select v from t where k = 'token')) ? 'items'), 'without the items');
select ok(not (verify_internal_receipt((select v from t where k = 'token')) ? 'entered_by'), 'or who entered it');
select is(verify_internal_receipt('not-a-real-token'), null, 'made-up codes find nothing');
reset role;
set local role anon;
select throws_ok($$ select verify_internal_receipt('x') $$, '42501', null, 'visitors go through the page, not the database');
select throws_ok($$ select get_internal_receipt(pg_temp.v('r1')) $$, '42501', null, 'the full receipt is private');
reset role;
select throws_ok($$ update internal_receipts set snapshot = '{}' $$, '42501', 'receipt_immutable', 'an issued receipt never changes');
set local role authenticated;

-- Void and reissue.
select pg_temp.login(3);
select throws_ok($$ select void_internal_receipt(pg_temp.v('r1'), 'no') $$, '22023', 'reason_required', 'voiding needs a reason');
select lives_ok($$ select void_internal_receipt(pg_temp.v('r1'), 'Wrong description') $$, 'finance voids it');
select is(get_expense(pg_temp.v('soap')) ->> 'evidence', 'missing', 'the line has no receipt again');
insert into t select 'r2', issue_internal_receipt(pg_temp.v('soap'), pg_temp.lock('soap'), null)::text;
select is(get_internal_receipt(pg_temp.v('r2')) ->> 'replaces', get_internal_receipt(pg_temp.v('r1')) ->> 'number', 'the new one says what it replaces');
select is(jsonb_array_length(get_expense(pg_temp.v('soap')) -> 'receipts'), 2, 'both are kept');
select * from finish();
rollback;
