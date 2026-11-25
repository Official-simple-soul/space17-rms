begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select * from no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated',
  jsonb_build_object('full_name', 'User ' || n) from generate_series(1, 6) n;
create function pg_temp.login(p_n int, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_n,
    'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
grant execute on function pg_temp.login(int, text) to authenticated, service_role;
grant usage on schema extensions to authenticated, service_role;
create temp table t (k text primary key, v text); grant all on t to authenticated, service_role;
create function pg_temp.v(p text) returns uuid language sql as $$ select v::uuid from t where k = p $$;
create function pg_temp.lock(p text) returns int language sql as $$ select (get_request(pg_temp.v(p)) ->> 'lock_version')::int $$;
create function pg_temp.st(p text) returns text language sql as $$ select get_request(pg_temp.v(p)) ->> 'status' $$;
grant execute on function pg_temp.v(text), pg_temp.lock(text), pg_temp.st(text) to authenticated, service_role;

-- 1 admin, 2 approver, 3 finance who also requests, 4 staff, 5 other organisation's finance, 6 second finance
insert into organisations (name, slug) values ('Org A', 'org-a'), ('Org B', 'org-b');
insert into t select slug, id::text from organisations where slug in ('org-a', 'org-b');
select app.seed_roles(pg_temp.v('org-a')); select app.seed_roles(pg_temp.v('org-b'));
insert into memberships (org_id, user_id)
  select pg_temp.v(case when n = 5 then 'org-b' else 'org-a' end), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 6) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id in (pg_temp.v('org-a'), pg_temp.v('org-b'));
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org-a');
insert into departments (org_id, name, code) values (pg_temp.v('org-a'), 'Field', 'FLD');
insert into t select code, id::text from departments where org_id = pg_temp.v('org-a');
insert into membership_roles (org_id, membership_id, role_id)
  select pg_temp.v('org-a'), pg_temp.v(m), pg_temp.v(r) from (values ('m1', 'admin'), ('m2', 'approver'), ('m3', 'finance'), ('m4', 'staff'), ('m6', 'finance')) x (m, r);
insert into membership_roles (org_id, membership_id, role_id)
  select pg_temp.v('org-b'), pg_temp.v('m5'), id from roles where org_id = pg_temp.v('org-b') and system_key = 'finance';
insert into department_members (org_id, department_id, membership_id)
  select pg_temp.v('org-a'), pg_temp.v('FLD'), pg_temp.v(m) from unnest(array['m3', 'm4']) m;
insert into categories (org_id, name, code, requires_accounting) values
  (pg_temp.v('org-a'), 'Supplies', 'SUP', true), (pg_temp.v('org-a'), 'Gifts', 'GFT', false);
insert into t select code, id::text from categories where org_id = pg_temp.v('org-a');
insert into category_approvers (org_id, category_id, role_id)
  select pg_temp.v('org-a'), pg_temp.v(c), pg_temp.v('approver') from unnest(array['SUP', 'GFT']) c;

create function pg_temp.make(p_key text, p_user int, p_cat text) returns void language plpgsql as $$
begin
  perform pg_temp.login(p_user);
  insert into t select p_key, save_request(pg_temp.v('org-a'), null, pg_temp.v(p_cat), pg_temp.v('FLD'), 'Request', 'For the office', null, '{}',
    '[{"description":"Item","quantity":1,"unit_price_minor":100000}]', null) ->> 'id';
  perform submit_request(pg_temp.v(p_key), 1);
  perform pg_temp.login(2);
  perform decide_request((get_request(pg_temp.v(p_key)) ->> 'active_step')::uuid, pg_temp.lock(p_key), 'approve', null);
end $$;
create function pg_temp.pay(p_key text, p_amount bigint, p_on date default current_date - 1) returns uuid language sql as $$
  select record_payment(pg_temp.v(p_key), pg_temp.lock(p_key), p_amount, p_on, 'bank_transfer', true, null, 'REF', null) $$;
grant execute on function pg_temp.make(text, int, text), pg_temp.pay(text, bigint, date) to authenticated;

set local role authenticated;
select pg_temp.make('r', 4, 'SUP');
select is(pg_temp.st('r'), 'approved', 'ready to pay');
select throws_ok($$ select * from payments $$, '42501', null, 'payments cannot be read directly');
select throws_ok($$ select * from bank_accounts $$, '42501', null, 'bank details cannot be read directly');

-- Bank details
select pg_temp.login(4);
select throws_ok($$ select save_bank_account(pg_temp.v('org-a'), 'GTBank', 'User 4', '12345') $$, '22023', 'invalid_account', 'account numbers are checked');
select lives_ok($$ select save_bank_account(pg_temp.v('org-a'), 'GTBank', 'User 4', '0123 456 789') $$, 'owner saves');
select is((select last_digits from my_bank_account(pg_temp.v('org-a'))), '6789', 'owner sees the last digits');
select throws_ok($$ select reveal_bank_account(pg_temp.v('r')) $$, '42501', 'not_allowed', 'staff cannot reveal');
reset role;
select ok(not exists (select 1 from bank_accounts b where to_jsonb(b)::text like '%0123456789%'), 'the number is not stored in the table');
select ok(not exists (select 1 from audit_logs a where to_jsonb(a)::text like '%0123456789%'), 'nor in the audit log');
select ok(not exists (select 1 from vault.secrets s where s.secret like '%0123456789%'), 'and is encrypted in the vault');
set local role authenticated;
select pg_temp.login(2);
select throws_ok($$ select reveal_bank_account(pg_temp.v('r')) $$, '42501', 'not_allowed', 'approvers cannot reveal');
select is(get_request(pg_temp.v('r')) -> 'bank', 'null'::jsonb, 'nor see masked details');
select pg_temp.login(5);
select throws_ok($$ select reveal_bank_account(pg_temp.v('r')) $$, 'P0002', 'not_found', 'another organisation cannot reveal');
select pg_temp.login(3, 'aal1');
select throws_ok($$ select reveal_bank_account(pg_temp.v('r')) $$, '42501', 'mfa_required', 'revealing needs MFA');
select pg_temp.login(3);
select is(reveal_bank_account(pg_temp.v('r')), '0123456789', 'finance reveals');
reset role;
select is((select count(*)::int from audit_logs where action = 'bank_details.revealed'), 1, 'every reveal is recorded');
set local role authenticated;
select pg_temp.login(4);
select save_bank_account(pg_temp.v('org-a'), 'UBA', 'User 4', '1111111111');
select is((select bank_name from my_bank_account(pg_temp.v('org-a'))), 'UBA', 'details can change');
select is((select count(*)::int from list_notifications(pg_temp.v('org-a')) where type = 'bank_details_changed'), 2, 'the owner is told each time');
reset role;
select is((select count(*)::int from vault.secrets where name like 'bank:%' and name = 'bank:' || pg_temp.v('m4')), 1, 'one secret per person');
set local role authenticated;

-- Recording
select pg_temp.login(4);
select throws_ok($$ select pg_temp.pay('r', 100) $$, '42501', 'not_allowed', 'staff cannot pay');
select pg_temp.login(5);
select throws_ok($$ select record_payment(pg_temp.v('r'), 1, 100, current_date, 'cash', true, null, null, null) $$, 'P0002', 'not_found', 'another organisation cannot pay');
select throws_ok($$ select * from list_payable(pg_temp.v('org-a')) $$, '42501', 'not_allowed', 'or list');
select pg_temp.login(3, 'aal1');
select throws_ok($$ select pg_temp.pay('r', 100) $$, '42501', 'mfa_required', 'paying needs MFA');
select pg_temp.login(3);
select throws_ok($$ select pg_temp.pay('r', 100001) $$, '22023', 'overpayment', 'overpayment fails');
select throws_ok($$ select pg_temp.pay('r', 0) $$, '22023', 'overpayment', 'zero fails');
select throws_ok($$ select pg_temp.pay('r', 100, current_date + 3) $$, '22023', 'invalid_paid_on', 'a future date fails');
select throws_ok($$ select record_payment(pg_temp.v('r'), 1, 100, current_date - 1, 'cash', true, null, null, null) $$, '22023', 'stale_request', 'an outdated page cannot pay');
select throws_ok($$ select record_payment(pg_temp.v('r'), pg_temp.lock('r'), 100, current_date - 1, 'cash', false, ' ', null, null) $$, '23514', null, 'a payee is needed');
select is((select count(*)::int from list_payable(pg_temp.v('org-a'))), 1, 'it is in the queue');
insert into t select 'p1', pg_temp.pay('r', 40000)::text;
select is(pg_temp.st('r'), 'part_paid', 'part paid');
select is((select paid_minor from list_payable(pg_temp.v('org-a'))), 40000::bigint, 'the queue shows what is paid');
select throws_ok($$ select pg_temp.pay('r', 60001) $$, '22023', 'overpayment', 'payments together cannot exceed the approval');
insert into t select 'p2', pg_temp.pay('r', 60000)::text;
select is(pg_temp.st('r'), 'paid', 'fully paid');
select throws_ok($$ select pg_temp.pay('r', 1) $$, '22023', 'not_payable', 'nothing more can be paid');
select throws_ok($$ select reveal_bank_account(pg_temp.v('r')) $$, '22023', 'not_payable', 'details are hidden once paid');
select matches((select string_agg(number, ',' order by number) from list_payments(pg_temp.v('org-a'))), '^PAY-\d{4}-0001,PAY-\d{4}-0002$', 'payments are numbered');

-- Confirming and voiding
select throws_ok($$ select confirm_payment(pg_temp.v('p1')) $$, 'P0002', 'not_found', 'only the requester confirms');
select pg_temp.login(4);
select is((select to_confirm from my_work(pg_temp.v('org-a'))), 2::bigint, 'the requester has two to confirm');
select confirm_payment(pg_temp.v('p1'));
select is(pg_temp.st('r'), 'paid', 'still waiting for the second');
select confirm_payment(pg_temp.v('p2')); select confirm_payment(pg_temp.v('p2'));
select is(pg_temp.st('r'), 'received', 'received once all are confirmed');
select throws_ok($$ select void_payment(pg_temp.v('p2'), pg_temp.lock('r'), 'Bounced back') $$, '42501', 'not_allowed', 'staff cannot void');
select pg_temp.login(6);
select throws_ok($$ select void_payment(pg_temp.v('p2'), pg_temp.lock('r'), ' ') $$, '22023', 'reason_required', 'voiding needs a reason');
select lives_ok($$ select void_payment(pg_temp.v('p2'), pg_temp.lock('r'), 'Bounced back') $$, 'finance voids');
select is(pg_temp.st('r'), 'part_paid', 'the balance is due again');
select throws_ok($$ select void_payment(pg_temp.v('p2'), pg_temp.lock('r'), 'Again please') $$, 'P0002', 'not_found', 'a payment is voided once');
reset role;
select throws_ok($$ update payments set status = 'voided' where id = pg_temp.v('p1') $$, '23514', null, 'a void always has who and why');
set local role authenticated;

-- Separation and closing
select pg_temp.make('own', 3, 'SUP');
select pg_temp.login(3);
select throws_ok($$ select pg_temp.pay('own', 100) $$, '42501', 'own_payment', 'nobody pays their own request');
select throws_ok($$ select reveal_bank_account(pg_temp.v('own')) $$, '42501', 'own_payment', 'or reveals through it');
select ok((select is_own from list_payable(pg_temp.v('org-a')) where id = pg_temp.v('own')), 'the queue marks it');
select is((select to_pay from my_work(pg_temp.v('org-a'))), 1::bigint, 'and does not count it');
select pg_temp.make('g', 4, 'GFT');
select pg_temp.login(6);
insert into t select 'p3', pg_temp.pay('g', 100000)::text;
select pg_temp.login(4); select confirm_payment(pg_temp.v('p3'));
select is(pg_temp.st('g'), 'closed', 'without accounting it closes');
select pg_temp.login(6);
select throws_ok($$ select void_payment(pg_temp.v('p3'), pg_temp.lock('g'), 'Too late') $$, '22023', 'void_closed', 'a closed request keeps its payments');

-- Proof
select throws_ok($$ select start_payment_proof(pg_temp.v('p1'), 'x.pdf', 'application/pdf', 5) $$, 'P0002', 'not_found', 'only the recorder adds proof');
select pg_temp.login(3);
insert into t select 'proof', start_payment_proof(pg_temp.v('p1'), 'x.pdf', 'application/pdf', 5) ->> 'id';
select is((select count(*)::int from get_pending_attachment(pg_temp.v('proof'))), 1, 'the recorder can finish it');
reset role; select finish_attachment(pg_temp.v('proof'), 5, 'abc'); set local role authenticated;
select pg_temp.login(4);
select is((select file_name from get_attachment(pg_temp.v('proof'))), 'x.pdf', 'the requester can open it');
select is(jsonb_array_length(get_request(pg_temp.v('r')) -> 'attachments'), 0, 'proof is not mixed with request files');
select throws_ok($$ select remove_attachment(pg_temp.v('proof')) $$, '22023', 'request_locked', 'and cannot be removed');

-- Email outbox
reset role;
select ok(not exists (select 1 from email_outbox o join notifications n on n.id = o.notification_id where n.type in ('request_comment', 'payment_confirmed')), 'only important events are emailed');
set local role authenticated;
select throws_ok($$ select * from claim_emails(5) $$, '42501', null, 'clients cannot take emails');
reset role;
update notifications set read_at = now() where id = (select notification_id from email_outbox order by created_at, id limit 1);
set local role service_role;
insert into t select 'e', (select id from claim_emails(1))::text;
select is((select count(*)::int from claim_emails(50) where id = pg_temp.v('e')), 0, 'a claimed email is not taken twice');
select finish_email(pg_temp.v('e'), 1::smallint, true);
reset role;
select is((select status from email_outbox where id = pg_temp.v('e')), 'sent', 'sent');
select ok(exists (select 1 from email_outbox where status = 'skipped'), 'already read notifications are skipped');
create temp table e2 as select id from email_outbox where status = 'pending' limit 1; grant select on e2 to service_role;
set local role service_role;
select finish_email((select id from e2), 9::smallint, true);
reset role;
select is((select status from email_outbox where id = (select id from e2)), 'pending', 'a stale worker cannot report');
update email_outbox set attempts = 6 where id = (select id from e2);
select finish_email((select id from e2), 6::smallint, false, 'Refused');
select is((select status from email_outbox where id = (select id from e2)), 'failed', 'gives up after six attempts');

-- Join codes
set local role authenticated;
select pg_temp.login(4);
select throws_ok($$ select set_join_code(pg_temp.v('org-a'), true) $$, '42501', 'not_allowed', 'staff cannot open joining');
select throws_ok($$ select get_join_code(pg_temp.v('org-a')) $$, '42501', 'not_allowed', 'or read the code');
select throws_ok($$ select * from submit_join_request('x', 'A B', 'x@test.local') $$, '42501', null, 'join requests go through the server');
select pg_temp.login(1);
insert into t select 'code', set_join_code(pg_temp.v('org-a'), true);
reset role;
create temp table j as select * from submit_join_request((select lower(v) from t where k = 'code'), 'New Person', 'New@test.local');
select is((select org_name from j), 'Org A', 'a valid code starts a request');
select throws_ok($$ select * from submit_join_request('WRONGCODE2', 'A B', 'x@test.local') $$, '22023', 'join_code_invalid', 'a wrong code fails');
select is((select count(*)::int from submit_join_request((select v from t where k = 'code'), 'User 4', 'u4@test.local')), 0, 'an existing member gets no email');
set local role authenticated;
select is((select count(*)::int from list_join_requests(pg_temp.v('org-a'))), 0, 'unverified requests are not shown');
reset role;
select throws_ok($$ select verify_join_request('nope') $$, '22023', 'invite_invalid', 'a wrong link fails');
select lives_ok($$ select verify_join_request((select token from j)) $$, 'email verified');
select is((select count(*)::int from auth.users where email = 'new@test.local'), 0, 'no account exists before approval');
insert into t select 'jr', id::text from join_requests where email = 'new@test.local';
set local role authenticated;
select pg_temp.login(1);
select is((select join_requests from my_work(pg_temp.v('org-a'))), 1::bigint, 'the admin sees it waiting');
select pg_temp.login(3);
select throws_ok($$ select * from approve_join_request(pg_temp.v('org-a'), pg_temp.v('jr'), pg_temp.v('staff')) $$, '42501', 'not_allowed', 'others cannot approve');
select pg_temp.login(1);
select is((select email from approve_join_request(pg_temp.v('org-a'), pg_temp.v('jr'), pg_temp.v('staff'))), 'new@test.local', 'approval creates an invitation');
select throws_ok($$ select * from approve_join_request(pg_temp.v('org-a'), pg_temp.v('jr'), pg_temp.v('staff')) $$, 'P0002', 'not_found', 'only once');
select set_join_code(pg_temp.v('org-a'), false);
reset role;
select throws_ok($$ select * from submit_join_request((select v from t where k = 'code'), 'A B', 'y@test.local') $$, '22023', 'join_code_invalid', 'a disabled code stops working');
select * from finish();
rollback;
