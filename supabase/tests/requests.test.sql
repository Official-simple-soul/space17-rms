begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select * from no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated',
  jsonb_build_object('full_name', 'User ' || n) from generate_series(1, 7) n;
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
create function pg_temp.lock(p text) returns int language sql as $$ select (get_request(pg_temp.v(p)) ->> 'lock_version')::int $$;
grant execute on function pg_temp.lock(text) to authenticated;
create function pg_temp.step(p text) returns uuid language sql as $$ select (get_request(pg_temp.v(p)) ->> 'active_step')::uuid $$;
grant execute on function pg_temp.step(text) to authenticated;

-- 1 admin; 2 and 3 approvers for Field; 4 staff in Field; 5 the only admin of org B;
-- 6 head of Finance; 7 finance, a member of the Finance department
insert into organisations (name, slug) values ('Org A', 'org-a'), ('Org B', 'org-b');
insert into t select slug, id::text from organisations where slug in ('org-a', 'org-b');
select app.seed_roles(pg_temp.v('org-a')); select app.seed_roles(pg_temp.v('org-b'));
insert into memberships (org_id, user_id)
  select pg_temp.v(case when n = 5 then 'org-b' else 'org-a' end), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 7) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id in (pg_temp.v('org-a'), pg_temp.v('org-b'));
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org-a');
insert into t select 'b-' || system_key, id::text from roles where org_id = pg_temp.v('org-b') and system_key in ('admin', 'staff');
insert into departments (org_id, name, code) values (pg_temp.v('org-a'), 'Finance', 'FIN'), (pg_temp.v('org-a'), 'Field', 'FLD'),
  (pg_temp.v('org-b'), 'Office', 'OFB');
insert into t select code, id::text from departments where org_id in (pg_temp.v('org-a'), pg_temp.v('org-b'));
insert into membership_roles (org_id, membership_id, role_id, department_id) values
  (pg_temp.v('org-a'), pg_temp.v('m1'), pg_temp.v('admin'), null),
  (pg_temp.v('org-b'), pg_temp.v('m5'), pg_temp.v('b-admin'), null), (pg_temp.v('org-b'), pg_temp.v('m5'), pg_temp.v('b-staff'), null),
  (pg_temp.v('org-a'), pg_temp.v('m2'), pg_temp.v('approver'), pg_temp.v('FLD')), (pg_temp.v('org-a'), pg_temp.v('m2'), pg_temp.v('staff'), null),
  (pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('approver'), pg_temp.v('FLD')),
  (pg_temp.v('org-a'), pg_temp.v('m4'), pg_temp.v('staff'), null), (pg_temp.v('org-a'), pg_temp.v('m6'), pg_temp.v('hod'), pg_temp.v('FIN')),
  (pg_temp.v('org-a'), pg_temp.v('m7'), pg_temp.v('finance'), null);
insert into department_members (org_id, department_id, membership_id) values
  (pg_temp.v('org-a'), pg_temp.v('FLD'), pg_temp.v('m4')), (pg_temp.v('org-a'), pg_temp.v('FLD'), pg_temp.v('m2')),
  (pg_temp.v('org-a'), pg_temp.v('FIN'), pg_temp.v('m6')), (pg_temp.v('org-a'), pg_temp.v('FIN'), pg_temp.v('m7')),
  (pg_temp.v('org-b'), pg_temp.v('OFB'), pg_temp.v('m5'));

set local role authenticated;
select pg_temp.login(1);
insert into t select 'cat', save_category(pg_temp.v('org-a'), null, 'Supplies')::text;
insert into t select 'old', save_category(pg_temp.v('org-a'), null, 'Old things')::text;
select archive_category(pg_temp.v('org-a'), pg_temp.v('old'));

-- What the form offers
select pg_temp.login(4);
select throws_ok($$ select * from requests $$, '42501', null, 'requests cannot be read directly');
select is(request_options(pg_temp.v('org-a')) -> 'departments',
  jsonb_build_array(jsonb_build_object('id', pg_temp.v('FLD'), 'name', 'Field', 'approvers', '["User 2", "User 3"]'::jsonb)),
  'my departments, with the people responsible for approving');
select is(request_options(pg_temp.v('org-a')) -> 'categories' -> 0 ->> 'name', 'Supplies', 'category labels, without archived ones');
select is(jsonb_array_length(request_options(pg_temp.v('org-a')) -> 'categories'), 1, 'only active categories');
select pg_temp.login(7);
select is(request_options(pg_temp.v('org-a')) -> 'departments' -> 0 -> 'approvers', '["User 6"]'::jsonb,
  'the head approves; admins are the quiet backup');
select pg_temp.login(6);
select is(request_options(pg_temp.v('org-a')) -> 'departments' -> 0 -> 'approvers', '["User 1"]'::jsonb,
  'a head''s own request goes to the backup');

-- Drafts
select pg_temp.login(4);
select throws_ok($$ select save_request(pg_temp.v('org-a'), null, pg_temp.v('FIN'), null, '', '', null, '', '[]', null, p_provision => 'money') $$, '22023', 'department_unavailable', 'a department I am not in is refused');
select throws_ok($$ select save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), pg_temp.v('old'), '', '', null, '', '[]', null, p_provision => 'money') $$, '22023', 'category_unavailable', 'archived categories are refused');
insert into t select 'r', save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), null, '', '', null, '', '[]', null, p_provision => 'money') ->> 'id';
select throws_ok($$ select submit_request(pg_temp.v('r'), 1) $$, '22023', 'request_incomplete', 'an empty draft cannot be submitted');
select is(save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('FLD'), pg_temp.v('cat'), 'Printer paper', 'For the office', null, ' Office Mart ',
  '[{"description":"Paper","quantity":2.5,"unit_price_minor":50000},{"description":"Ink","quantity":1,"unit_price_minor":25000}]', 1, p_provision => 'money') ->> 'version', '2', 'saving moves the version');
select is((get_request(pg_temp.v('r')) ->> 'total_minor')::bigint, 150000::bigint, 'the database calculates the total');
select is(get_request(pg_temp.v('r')) ->> 'supplier', 'Office Mart', 'the preferred seller is kept');
select throws_ok($$ select save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('FLD'), null, 'Old', '', null, '', '[]', 1, p_provision => 'money') $$, '22023', 'stale_request', 'an older tab cannot overwrite');
select throws_ok($$ select save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('FLD'), null, 'X', '', null, '', '[{"description":"A","quantity":-1,"unit_price_minor":5}]', 2, p_provision => 'money') $$, '23514', null, 'negative quantities fail');
select pg_temp.login(1);
select throws_ok($$ select get_request(pg_temp.v('r')) $$, 'P0002', 'not_found', 'drafts are private, even from admins');
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'all')), 0, 'drafts are not listed for others');
select pg_temp.login(2);
select throws_ok($$ select submit_request(pg_temp.v('r'), 2) $$, 'P0002', 'not_found', 'only the requester submits');

-- Submit
select pg_temp.login(4);
select lives_ok($$ select submit_request(pg_temp.v('r'), 2) $$, 'submits');
select matches(get_request(pg_temp.v('r')) ->> 'number', '^REQ-\d{4}-0001$', 'a number is assigned');
select is(jsonb_array_length(get_request(pg_temp.v('r')) -> 'steps'), 1, 'one approval is enough');
select is(get_request(pg_temp.v('r')) -> 'steps' -> 0 -> 'people', '["User 2", "User 3"]'::jsonb, 'it names the department''s approvers');
select throws_ok($$ select save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('FLD'), null, 'Changed', 'Changed', null, '', '[]', pg_temp.lock('r'), p_provision => 'money') $$, '22023', 'request_locked', 'a pending request cannot be edited');
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null) $$, '42501', 'own_request', 'nobody approves their own request');

-- Visibility
select pg_temp.login(5);
select throws_ok($$ select get_request(pg_temp.v('r')) $$, 'P0002', 'not_found', 'another organisation cannot see it');
select throws_ok($$ select * from list_requests(pg_temp.v('org-a'), 'all') $$, '42501', 'not_allowed', 'another organisation cannot list');
select pg_temp.login(6);
select throws_ok($$ select get_request(pg_temp.v('r')) $$, 'P0002', 'not_found', 'the head of another department cannot see it');
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'all')), 0, 'and it is not listed for them');
select throws_ok($$ select send_request_message(pg_temp.v('r'), 'Hello') $$, 'P0002', 'not_found', 'nor can they comment');
select pg_temp.login(7);
select lives_ok($$ select get_request(pg_temp.v('r')) $$, 'finance sees the whole organisation');
select ok((get_request(pg_temp.v('r')) ->> 'my_step') is null, 'but cannot decide');
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null) $$, '42501', 'not_allowed', 'and is refused if they try');
select pg_temp.login(1);
select is((select count(*)::int from list_notifications(pg_temp.v('org-a'))), 0, 'admins are not alerted while the department has approvers');
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'inbox')), 1, 'but can still act on it');

-- Decide
select pg_temp.login(2);
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'inbox')), 1, 'it is in the approver inbox');
select is((select approvals from my_work(pg_temp.v('org-a'))), 1::bigint, 'the badge counts it');
select is((select type from list_notifications(pg_temp.v('org-a'))), 'approval_needed', 'the approver is notified');
select throws_ok($$ select decide_request(pg_temp.step('r'), 1, 'approve', null) $$, '22023', 'stale_request', 'an outdated page cannot decide');
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'return', ' ') $$, '22023', 'reason_required', 'returning needs a reason');
insert into t select 'paper', i ->> 'id' from jsonb_array_elements(get_request(pg_temp.v('r')) -> 'items') i where i ->> 'description' = 'Paper';
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', 'More please', jsonb_build_array(jsonb_build_object('id', pg_temp.v('paper'), 'approved_minor', 125001))) $$, '22023', 'invalid_amounts', 'amounts cannot rise');
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null, jsonb_build_array(jsonb_build_object('id', pg_temp.v('paper'), 'approved_minor', 100000))) $$, '22023', 'reason_required', 'a reduction needs a reason');
select lives_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', 'Two reams are enough', jsonb_build_array(jsonb_build_object('id', pg_temp.v('paper'), 'approved_minor', 100000))) $$, 'approves with a reduction');
select is((get_request(pg_temp.v('r')) ->> 'approved_minor')::bigint, 125000::bigint, 'the approved amount falls');
select is(get_request(pg_temp.v('r')) ->> 'status', 'approved', 'one approval completes it');
select pg_temp.login(3);
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'inbox')), 0, 'and it leaves the other approvers'' inboxes');
select pg_temp.login(4);
select is((select string_agg(type, ',') from list_notifications(pg_temp.v('org-a'))), 'request_approved', 'the requester is told');
select throws_ok($$ select withdraw_request(pg_temp.v('r'), pg_temp.lock('r'), 'Changed my mind') $$, '22023', 'request_locked', 'an approved request cannot be withdrawn');

-- Return, edit and resubmit; an admin approves as backup
insert into t select 'r2', save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), null, 'Pens', 'For the office', null, '', '[{"description":"Pens","quantity":1,"unit_price_minor":50000}]', null, p_provision => 'money') ->> 'id';
select submit_request(pg_temp.v('r2'), 1);
select pg_temp.login(2);
select decide_request(pg_temp.step('r2'), pg_temp.lock('r2'), 'return', 'Say which pens');
select pg_temp.login(4);
select is((select returned from my_work(pg_temp.v('org-a'))), 1::bigint, 'returned work is counted');
select save_request(pg_temp.v('org-a'), pg_temp.v('r2'), pg_temp.v('FLD'), null, 'Blue pens', 'For the office', null, '', '[{"description":"Blue pens","quantity":1,"unit_price_minor":150000}]', pg_temp.lock('r2'), p_provision => 'money');
select submit_request(pg_temp.v('r2'), pg_temp.lock('r2'));
select matches(get_request(pg_temp.v('r2')) ->> 'number', '-0002$', 'the number stays the same');
reset role;
select is((select string_agg(status, ',' order by run_no) from approval_runs where request_id = pg_temp.v('r2')), 'returned,active', 'earlier runs are kept');
select is((select snapshot ->> 'title' from approval_runs where request_id = pg_temp.v('r2') and run_no = 1), 'Pens', 'what was first submitted is kept');
select throws_ok($$ update approval_actions set action = 'reject' $$, '42501', null, 'decisions cannot change');
select throws_ok($$ delete from request_events $$, '42501', null, 'the timeline cannot change');
set local role authenticated;
select pg_temp.login(1);
select lives_ok($$ select decide_request(pg_temp.step('r2'), pg_temp.lock('r2'), 'approve', null) $$, 'an admin can approve as backup');
select is(get_request(pg_temp.v('r2')) ->> 'status', 'approved', 'approved by the admin');

-- Leavers lose their say at once; reassigning still works.
select pg_temp.login(4);
insert into t select 'r3', save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), null, 'Chairs', 'For the hall', null, '', '[{"description":"Chair","quantity":4,"unit_price_minor":20000}]', null, p_provision => 'money') ->> 'id';
select submit_request(pg_temp.v('r3'), 1);
select pg_temp.login(1);
select set_member_status(pg_temp.v('org-a'), pg_temp.v('m3'), 'suspended', 'On leave');
select pg_temp.login(3);
select throws_ok($$ select get_request(pg_temp.v('r3')) $$, 'P0002', 'not_found', 'a suspended approver sees nothing');
select pg_temp.login(2);
select throws_ok($$ select reassign_step(pg_temp.step('r3'), pg_temp.v('m7'), 'Approver away') $$, '42501', 'not_allowed', 'approvers cannot reassign');
select pg_temp.login(1, 'aal1');
select throws_ok($$ select reassign_step(pg_temp.step('r3'), pg_temp.v('m7'), 'Approver away') $$, '42501', 'mfa_required', 'reassigning needs MFA');
select pg_temp.login(1);
select throws_ok($$ select reassign_step(pg_temp.step('r3'), pg_temp.v('m7'), 'Approver away') $$, '22023', 'cannot_reassign', 'only to someone who may approve');
select throws_ok($$ select reassign_step(pg_temp.step('r3'), pg_temp.v('m4'), 'Approver away') $$, '22023', 'cannot_reassign', 'never to the requester');
select grant_role(pg_temp.v('org-a'), pg_temp.v('m7'), pg_temp.v('approver'), pg_temp.v('FLD'));
select lives_ok($$ select reassign_step(pg_temp.step('r3'), pg_temp.v('m7'), 'Approver away') $$, 'reassigns');
select pg_temp.login(2);
select ok((get_request(pg_temp.v('r3')) ->> 'my_step') is null, 'once reassigned, only that person decides');
select pg_temp.login(7);
select decide_request(pg_temp.step('r3'), pg_temp.lock('r3'), 'approve', null);
select is(get_request(pg_temp.v('r3')) ->> 'status', 'approved', 'the new approver completes it');

-- Heads approve their own department; their own requests go to someone else.
select pg_temp.login(7);
insert into t select 'fin', save_request(pg_temp.v('org-a'), null, pg_temp.v('FIN'), null, 'Calculator', 'For reconciliations', null, '', '[{"description":"Calculator","quantity":1,"unit_price_minor":15000}]', null, p_provision => 'money') ->> 'id';
select submit_request(pg_temp.v('fin'), 1);
select pg_temp.login(6);
select is((select type from list_notifications(pg_temp.v('org-a'))), 'approval_needed', 'the head is alerted');
select lives_ok($$ select decide_request(pg_temp.step('fin'), pg_temp.lock('fin'), 'approve', null) $$, 'the head approves');
insert into t select 'own', save_request(pg_temp.v('org-a'), null, pg_temp.v('FIN'), null, 'Desk', 'Mine is broken', null, '', '[{"description":"Desk","quantity":1,"unit_price_minor":90000}]', null, p_provision => 'money') ->> 'id';
select submit_request(pg_temp.v('own'), 1);
select pg_temp.login(1);
select is((select count(*)::int from list_notifications(pg_temp.v('org-a')) where type = 'approval_needed'), 1, 'with no one else in the department, admins are alerted');
select lives_ok($$ select decide_request(pg_temp.step('own'), pg_temp.lock('own'), 'approve', null) $$, 'and approve it');

-- Nobody else to approve fails before submitting.
select pg_temp.login(5);
insert into t select 'solo', save_request(pg_temp.v('org-b'), null, pg_temp.v('OFB'), null, 'Stamps', 'Post', null, '', '[{"description":"Stamps","quantity":1,"unit_price_minor":1000}]', null, p_provision => 'money') ->> 'id';
select is(request_options(pg_temp.v('org-b')) -> 'departments' -> 0 -> 'approvers', '[]'::jsonb, 'the form can warn early');
select throws_ok($$ select submit_request(pg_temp.v('solo'), 1) $$, '22023', 'no_approver', 'the requester does not count as an approver');

-- An amount is needed; withdraw
select pg_temp.login(4);
insert into t select 'r4', save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), null, 'Use the hall', 'Training day', null, '', '[]', null, p_provision => 'money') ->> 'id';
select throws_ok($$ select submit_request(pg_temp.v('r4'), 1) $$, '22023', 'amount_missing', 'a request needs an amount');
insert into t select 'r5', save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), null, 'Gold pens', 'For the office', null, '', '[{"description":"Pens","quantity":1,"unit_price_minor":5000}]', null, p_provision => 'money') ->> 'id';
select submit_request(pg_temp.v('r5'), 1);
select lives_ok($$ select withdraw_request(pg_temp.v('r5'), pg_temp.lock('r5'), 'Not needed') $$, 'withdraws');
select is(get_request(pg_temp.v('r5')) ->> 'status', 'cancelled', 'withdrawn');
select pg_temp.login(2);
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'inbox')), 0, 'and leaves the inbox');
select throws_ok($$ select delete_draft(pg_temp.v('r5')) $$, 'P0002', 'not_found', 'others cannot delete');

-- Questions and answers
select pg_temp.login(4);
insert into t select 'q', save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), null, 'Paint', 'For the hall', null, '', '[{"description":"Paint","quantity":2,"unit_price_minor":8000}]', null, p_provision => 'money') ->> 'id';
select throws_ok($$ select send_request_message(pg_temp.v('q'), 'Hi') $$, '42501', 'not_allowed', 'drafts have no conversation');
select submit_request(pg_temp.v('q'), 1);
select throws_ok($$ select send_request_message(pg_temp.v('q'), 'Is this fine?', true) $$, '42501', 'not_allowed', 'the requester does not ask themselves');
select pg_temp.login(2);
select ok((get_request(pg_temp.v('q')) ->> 'can_ask')::boolean, 'an approver can ask');
select lives_ok($$ select send_request_message(pg_temp.v('q'), 'Which colour?', true) $$, 'and asks');
select is(get_request(pg_temp.v('q')) #>> '{chat,status}', 'open', 'it waits for the requester');
select is(get_request(pg_temp.v('q')) #>> '{chat,messages,0,title}', 'Approver', 'with their part shown');
select pg_temp.login(4);
select ok(exists (select 1 from list_notifications(pg_temp.v('org-a')) n where n.type = 'request_question' and n.request_id = pg_temp.v('q')), 'the requester is asked');
select is((select questions from my_work(pg_temp.v('org-a'))), 1::bigint, 'and it is counted for them');
select lives_ok($$ select send_request_message(pg_temp.v('q'), 'White, please') $$, 'the requester answers');
select is(get_request(pg_temp.v('q')) #>> '{chat,status}', 'answered', 'answered');
select ok((get_request(pg_temp.v('q')) #>> '{chat,messages,1,mine}')::boolean, 'their own message is marked');
select is((select questions from my_work(pg_temp.v('org-a'))), 0::bigint, 'nothing waiting now');
select pg_temp.login(2);
select ok(exists (select 1 from list_notifications(pg_temp.v('org-a')) n where n.type = 'request_comment' and n.request_id = pg_temp.v('q')), 'the approver hears back');
select pg_temp.login(6);
select throws_ok($$ select send_request_message(pg_temp.v('q'), 'Hi') $$, 'P0002', 'not_found', 'others cannot join in');
reset role;
select throws_ok($$ delete from messages $$, '42501', null, 'messages cannot be removed');
set local role authenticated;

-- Files
select pg_temp.login(4);
insert into t select 'r6', save_request(pg_temp.v('org-a'), null, pg_temp.v('FLD'), null, 'Abuja trip', 'Site visit', null, '', '[{"description":"Bus fare","quantity":1,"unit_price_minor":30000}]', null, p_provision => 'money') ->> 'id';
select throws_ok($$ select start_attachment(pg_temp.v('r6'), 'quotation', 'x.exe', 'application/x-msdownload', 10) $$, '23514', null, 'unsafe file types fail');
select throws_ok($$ select start_attachment(pg_temp.v('r6'), 'mode', 'x.pdf', 'application/pdf', 10) $$, 'P0002', 'not_found', 'files are a quotation or a general attachment');
insert into t select 'a', start_attachment(pg_temp.v('r6'), 'quotation', 'quote.pdf', 'application/pdf', 10) ->> 'id';
select throws_ok($$ select finish_attachment(pg_temp.v('a'), 10, 'x') $$, '42501', null, 'clients cannot mark a file as checked');
select pg_temp.login(2);
select throws_ok($$ select start_attachment(pg_temp.v('r6'), null, 'x.pdf', 'application/pdf', 10) $$, 'P0002', 'not_found', 'others cannot add files');
select is((select count(*)::int from get_pending_attachment(pg_temp.v('a'))), 0, 'others cannot see uploads');
reset role;
select finish_attachment(pg_temp.v('a'), 12, 'abc');
set local role authenticated;
select pg_temp.login(2);
select throws_ok($$ select * from get_attachment(pg_temp.v('a')) $$, 'P0002', 'not_found', 'a draft file is private');
select pg_temp.login(4);
select lives_ok($$ select submit_request(pg_temp.v('r6'), 1) $$, 'submits with a quotation');
select throws_ok($$ select remove_attachment(pg_temp.v('a')) $$, '22023', 'request_locked', 'files are fixed while pending');
select pg_temp.login(2);
select is((select file_name from get_attachment(pg_temp.v('a'))), 'quote.pdf', 'the approver can open it');
select decide_request(pg_temp.step('r6'), pg_temp.lock('r6'), 'return', 'Newer quote please');
select pg_temp.login(4);
select is(remove_attachment(pg_temp.v('a')), null, 'a file approvers saw is kept in storage');
select is(jsonb_array_length(get_request(pg_temp.v('r6')) -> 'attachments'), 0, 'but no longer shown');

select mark_notifications_read(pg_temp.v('org-a'));
select is((select unread from my_work(pg_temp.v('org-a'))), 0::bigint, 'notifications can be cleared');
select pg_temp.login(2);
select ok((select unread from my_work(pg_temp.v('org-a'))) > 0, 'without clearing anyone else''s');
select * from finish();
rollback;
