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
create function pg_temp.lock(p text) returns int language sql as $$ select (get_request(pg_temp.v(p)) ->> 'lock_version')::int $$;
create function pg_temp.st(p text) returns text language sql as $$ select get_request(pg_temp.v(p)) ->> 'status' $$;
grant execute on function pg_temp.v(text), pg_temp.lock(text), pg_temp.st(text) to authenticated;

-- 1 admin, 2 head of Field, 3 finance, 4 a child in Field, 5 another member of Field
insert into organisations (name, slug) values ('Org A', 'org-a');
insert into t select 'org', id::text from organisations where slug = 'org-a';
select app.seed_roles(pg_temp.v('org'));
insert into memberships (org_id, user_id) select pg_temp.v('org'), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 5) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id = pg_temp.v('org');
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org');
insert into departments (org_id, name, code) values (pg_temp.v('org'), 'Field', 'FLD');
insert into t select code, id::text from departments where org_id = pg_temp.v('org');
insert into membership_roles (org_id, membership_id, role_id, department_id) values
  (pg_temp.v('org'), pg_temp.v('m1'), pg_temp.v('admin'), null), (pg_temp.v('org'), pg_temp.v('m2'), pg_temp.v('hod'), pg_temp.v('FLD')),
  (pg_temp.v('org'), pg_temp.v('m3'), pg_temp.v('finance'), null), (pg_temp.v('org'), pg_temp.v('m4'), pg_temp.v('staff'), null),
  (pg_temp.v('org'), pg_temp.v('m5'), pg_temp.v('staff'), null);
insert into department_members (org_id, department_id, membership_id)
  select pg_temp.v('org'), pg_temp.v('FLD'), pg_temp.v(m) from unnest(array['m2', 'm4', 'm5']) m;

create function pg_temp.ask(p_key text, p_provision text, p_price bigint) returns void language plpgsql as $$
begin
  perform pg_temp.login(4);
  insert into t select p_key, save_request(pg_temp.v('org'), null, pg_temp.v('FLD'), null, 'Laptop', 'For school work', null,
    'Computer Village', case when p_price > 0 then jsonb_build_array(jsonb_build_object('description', 'Laptop', 'quantity', 1,
    'unit_price_minor', p_price)) else '[]'::jsonb end, null, p_provision) ->> 'id';
end $$;
grant execute on function pg_temp.ask(text, text, bigint) to authenticated;
set local role authenticated;

-- How it is provided must be chosen.
select pg_temp.ask('none', null, 100000);
select throws_ok($$ select submit_request(pg_temp.v('none'), 1) $$, '22023', 'provision_missing', 'the choice is needed to send');

-- Provided: no amount needed, never paid here, handed over and confirmed.
select pg_temp.ask('stock', 'provide', 0);
select lives_ok($$ select submit_request(pg_temp.v('stock'), 1) $$, 'a provided item needs no amount');
select pg_temp.login(2);
select decide_request((get_request(pg_temp.v('stock')) ->> 'active_step')::uuid, pg_temp.lock('stock'), 'approve', null);
select is(pg_temp.st('stock'), 'approved', 'approved, waiting to be handed over');
select ok((get_request(pg_temp.v('stock')) ->> 'can_hand_over')::boolean, 'the head can hand it over');
select is((select to_hand_over from my_work(pg_temp.v('org'))), 1::bigint, 'and it is counted for them');
select is((select count(*)::int from list_requests(pg_temp.v('org'), 'all', '', 'to_hand_over')), 1, 'and listed');
select pg_temp.login(3);
select is((select count(*)::int from list_payable(pg_temp.v('org'))), 0, 'nothing to pay');
select throws_ok($$ select record_payment(pg_temp.v('stock'), pg_temp.lock('stock'), 100, current_date, 'cash', false, 'Shop', null, null) $$,
  '22023', 'not_payable', 'and payment is refused');
select pg_temp.login(5);
select throws_ok($$ select hand_over_item(pg_temp.v('stock'), 1, null) $$, 'P0002', 'not_found', 'colleagues cannot hand it over');
select pg_temp.login(4);
select ok(not (get_request(pg_temp.v('stock')) ->> 'can_hand_over')::boolean, 'nor can the requester');
select throws_ok($$ select hand_over_item(pg_temp.v('stock'), pg_temp.lock('stock'), null) $$, '42501', 'not_allowed', 'even directly');
select throws_ok($$ select confirm_item(pg_temp.v('stock'), pg_temp.lock('stock')) $$, '22023', 'request_locked', 'nothing to confirm yet');
select pg_temp.login(2);
select throws_ok($$ select hand_over_item(pg_temp.v('stock'), 1, null) $$, '22023', 'stale_request', 'an outdated page cannot hand over');
select lives_ok($$ select hand_over_item(pg_temp.v('stock'), pg_temp.lock('stock'), 'Office laptop L-07') $$, 'the head hands it over');
select is(pg_temp.st('stock'), 'handed_over', 'handed over');
select pg_temp.login(4);
select ok(exists (select 1 from list_notifications(pg_temp.v('org')) n where n.type = 'item_handed_over' and n.request_id = pg_temp.v('stock')), 'the child is told');
select is(get_request(pg_temp.v('stock')) #>> '{handover,note}', 'Office laptop L-07', 'with the note');
select is((select to_collect from my_work(pg_temp.v('org'))), 1::bigint, 'and asked to confirm');
select lives_ok($$ select confirm_item(pg_temp.v('stock'), pg_temp.lock('stock')) $$, 'the child confirms');
select is(pg_temp.st('stock'), 'closed', 'done');
select pg_temp.login(2);
select ok(exists (select 1 from list_notifications(pg_temp.v('org')) n where n.type = 'item_received' and n.request_id = pg_temp.v('stock')), 'the head hears it arrived');

-- Bought offline: recorded as an expense linked to the request, then handed over.
select pg_temp.ask('buy', 'provide', 45000000);
select submit_request(pg_temp.v('buy'), 1);
select pg_temp.login(2);
select decide_request((get_request(pg_temp.v('buy')) ->> 'active_step')::uuid, pg_temp.lock('buy'), 'approve', null);
select is(pg_temp.st('buy'), 'approved', 'approved and ready to provide');
select pg_temp.login(3);
select is((select count(*)::int from list_payable(pg_temp.v('org'))), 0, 'finance has nothing to pay');
select throws_ok($$ select record_payment(pg_temp.v('buy'), pg_temp.lock('buy'), 100, current_date, 'bank_transfer', false, 'Shop', null, null) $$,
  '22023', 'not_payable', 'provided items are not paid here');
select pg_temp.login(4);
select ok(not (get_request(pg_temp.v('buy')) ->> 'needs_bank')::boolean, 'the child is not asked for bank details');
select is((select count(*)::int from linkable_requests(pg_temp.v('org')) where id = pg_temp.v('buy')), 0, 'the child does not record the purchase');
select pg_temp.login(5);
select is((select count(*)::int from linkable_requests(pg_temp.v('org')) where id = pg_temp.v('buy')), 0, 'nor do colleagues');
select pg_temp.login(2);
reset role;
insert into categories (org_id, name) values (pg_temp.v('org'), 'Equipment');
set local role authenticated;
select lives_ok(format($$ select save_expense(pg_temp.v('org'), null, %L, pg_temp.v('FLD'), pg_temp.v('buy'), current_date,
  'Laptop for User 4', 'Computer Village', 'Ikeja', null, 'department', false, null,
  '[{"description":"Laptop","quantity":1,"unit_price_minor":44000000}]', null) $$,
  (select id from categories where org_id = pg_temp.v('org') and name = 'Equipment')), 'the head records the purchase against it');
select lives_ok($$ select hand_over_item(pg_temp.v('buy'), pg_temp.lock('buy'), 'HP laptop, serial 123') $$, 'and hands it over');
select pg_temp.login(4);
select lives_ok($$ select confirm_item(pg_temp.v('buy'), pg_temp.lock('buy')) $$, 'the child confirms');
select is(pg_temp.st('buy'), 'closed', 'done');
select * from finish();
rollback;
