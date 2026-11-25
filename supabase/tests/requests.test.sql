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

-- 1 admin, 2 and 3 approvers, 4 requester (staff), 5 other org admin, 6 head of another department, 7 finance + approver
insert into organisations (name, slug) values ('Org A', 'org-a'), ('Org B', 'org-b');
insert into t select slug, id::text from organisations where slug in ('org-a', 'org-b');
select app.seed_roles(pg_temp.v('org-a')); select app.seed_roles(pg_temp.v('org-b'));
insert into memberships (org_id, user_id)
  select pg_temp.v(case when n = 5 then 'org-b' else 'org-a' end), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 7) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id in (pg_temp.v('org-a'), pg_temp.v('org-b'));
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org-a');
insert into t select 'b-admin', id::text from roles where org_id = pg_temp.v('org-b') and system_key = 'admin';
insert into departments (org_id, name, code) values (pg_temp.v('org-a'), 'Finance', 'FIN'), (pg_temp.v('org-a'), 'Field', 'FLD');
insert into t select code, id::text from departments where org_id = pg_temp.v('org-a');
insert into membership_roles (org_id, membership_id, role_id, department_id) values
  (pg_temp.v('org-a'), pg_temp.v('m1'), pg_temp.v('admin'), null), (pg_temp.v('org-b'), pg_temp.v('m5'), pg_temp.v('b-admin'), null),
  (pg_temp.v('org-a'), pg_temp.v('m2'), pg_temp.v('approver'), null), (pg_temp.v('org-a'), pg_temp.v('m2'), pg_temp.v('staff'), null),
  (pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('approver'), null),
  (pg_temp.v('org-a'), pg_temp.v('m4'), pg_temp.v('staff'), null), (pg_temp.v('org-a'), pg_temp.v('m6'), pg_temp.v('hod'), pg_temp.v('FIN')),
  (pg_temp.v('org-a'), pg_temp.v('m7'), pg_temp.v('finance'), null);
insert into department_members (org_id, department_id, membership_id) values
  (pg_temp.v('org-a'), pg_temp.v('FLD'), pg_temp.v('m4')), (pg_temp.v('org-a'), pg_temp.v('FLD'), pg_temp.v('m2')),
  (pg_temp.v('org-a'), pg_temp.v('FIN'), pg_temp.v('m6'));

set local role authenticated;
select pg_temp.login(1);
insert into t select 'tpl', save_template(pg_temp.v('org-a'), null, 'request', 'Trip',
  '[{"key":"mode","label":"Mode","type":"dropdown","required":true,"options":["Road","Air"]},{"key":"quote","label":"Quote","type":"file","required":true}]', null) ->> 'id';
insert into t select 'wf', save_workflow(pg_temp.v('org-a'), null, 'request', 'Two', jsonb_build_array(
  jsonb_build_object('name', 'First', 'approver_type', 'category_approvers', 'required_approvals', 1),
  jsonb_build_object('name', 'Second', 'approver_type', 'role', 'role_id', pg_temp.v('approver'), 'required_approvals', 2, 'min_amount_minor', 100000)), null) ->> 'id';
insert into t select 'cat', save_category(pg_temp.v('org-a'), null, 'Supplies', 'SUP', 'both', true, null, pg_temp.v('wf'), '{}',
  jsonb_build_array(jsonb_build_object('role_id', pg_temp.v('approver'))))::text;
insert into t select 'trip', save_category(pg_temp.v('org-a'), null, 'Trips', 'TRP', 'both', true, pg_temp.v('tpl'), null, array[pg_temp.v('FLD')],
  jsonb_build_array(jsonb_build_object('role_id', pg_temp.v('approver'))))::text;
insert into t select 'fin-only', save_category(pg_temp.v('org-a'), null, 'Audit fees', 'AUD', 'both', true, null, null, array[pg_temp.v('FIN')], '[]')::text;

-- Drafts
select pg_temp.login(4);
select throws_ok($$ select * from requests $$, '42501', null, 'requests cannot be read directly');
select is((select string_agg(name, ',') from requestable_categories(pg_temp.v('org-a'))), 'Supplies,Trips', 'only categories open to my departments');
select throws_ok($$ select save_request(pg_temp.v('org-a'), null, pg_temp.v('fin-only'), null, '', '', null, '{}', '[]', null) $$, '22023', 'category_unavailable', 'restricted categories are refused');
select throws_ok($$ select save_request(pg_temp.v('org-a'), null, pg_temp.v('cat'), pg_temp.v('FIN'), '', '', null, '{}', '[]', null) $$, '22023', 'category_unavailable', 'a department I am not in is refused');
insert into t select 'r', save_request(pg_temp.v('org-a'), null, pg_temp.v('cat'), pg_temp.v('FLD'), '', '', null, '{"junk":1}', '[]', null) ->> 'id';
select is(get_request(pg_temp.v('r')) -> 'form_data', '{}'::jsonb, 'unknown answers are dropped');
select throws_ok($$ select submit_request(pg_temp.v('r'), 1) $$, '22023', 'request_incomplete', 'an empty draft cannot be submitted');
select is(save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('cat'), pg_temp.v('FLD'), 'Printer paper', 'For the office', null, '{}',
  '[{"description":"Paper","quantity":2.5,"unit_price_minor":50000},{"description":"Ink","quantity":1,"unit_price_minor":25000}]', 1) ->> 'version', '2', 'saving moves the version');
select is((get_request(pg_temp.v('r')) ->> 'total_minor')::bigint, 150000::bigint, 'the database calculates the total');
select throws_ok($$ select save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('cat'), null, 'Old', '', null, '{}', '[]', 1) $$, '22023', 'stale_request', 'an older tab cannot overwrite');
select throws_ok($$ select save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('cat'), null, 'X', '', null, '{}', '[{"description":"A","quantity":-1,"unit_price_minor":5}]', 2) $$, '23514', null, 'negative quantities fail');
select pg_temp.login(1);
select throws_ok($$ select get_request(pg_temp.v('r')) $$, 'P0002', 'not_found', 'drafts are private, even from admins');
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'all')), 0, 'drafts are not listed for others');
select pg_temp.login(2);
select throws_ok($$ select submit_request(pg_temp.v('r'), 2) $$, 'P0002', 'not_found', 'only the requester submits');

-- Submit
select pg_temp.login(4);
select lives_ok($$ select submit_request(pg_temp.v('r'), 2) $$, 'submits');
select matches(get_request(pg_temp.v('r')) ->> 'number', '^REQ-\d{4}-0001$', 'a number is assigned');
select is(jsonb_array_length(get_request(pg_temp.v('r')) -> 'steps'), 2, 'the threshold adds the second step');
select throws_ok($$ select save_request(pg_temp.v('org-a'), pg_temp.v('r'), pg_temp.v('cat'), pg_temp.v('FLD'), 'Changed', 'Changed', null, '{}', '[]', pg_temp.lock('r')) $$, '22023', 'request_locked', 'a pending request cannot be edited');
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null) $$, '42501', 'own_request', 'nobody approves their own request');

-- Visibility
select pg_temp.login(5);
select throws_ok($$ select get_request(pg_temp.v('r')) $$, 'P0002', 'not_found', 'another organisation cannot see it');
select throws_ok($$ select * from list_requests(pg_temp.v('org-a'), 'all') $$, '42501', 'not_allowed', 'another organisation cannot list');
select pg_temp.login(6);
select throws_ok($$ select get_request(pg_temp.v('r')) $$, 'P0002', 'not_found', 'the head of another department cannot see it');
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'all')), 0, 'and it is not listed for them');
select throws_ok($$ select comment_on_request(pg_temp.v('r'), 'Hello') $$, 'P0002', 'not_found', 'nor can they comment');
select pg_temp.login(7);
select lives_ok($$ select get_request(pg_temp.v('r')) $$, 'finance sees the whole organisation');
select ok((get_request(pg_temp.v('r')) ->> 'my_step') is null, 'but cannot decide');
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null) $$, '42501', 'not_allowed', 'and is refused if they try');

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
select is(get_request(pg_temp.v('r')) ->> 'status', 'pending', 'still pending the second step');
select lives_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null) $$, 'first of two approvals');
select ok((get_request(pg_temp.v('r')) ->> 'already_decided')::boolean, 'cannot decide the same step twice');
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null) $$, '42501', 'not_allowed', 'a second vote by the same person fails');
select pg_temp.login(3);
select throws_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', 'Raise it', jsonb_build_array(jsonb_build_object('id', pg_temp.v('paper'), 'approved_minor', 120000))) $$, '22023', 'invalid_amounts', 'a later approver cannot undo a reduction');
select lives_ok($$ select decide_request(pg_temp.step('r'), pg_temp.lock('r'), 'approve', null) $$, 'second approval completes it');
select is(get_request(pg_temp.v('r')) ->> 'status', 'approved', 'approved');
select pg_temp.login(4);
select is((select string_agg(type, ',') from list_notifications(pg_temp.v('org-a'))), 'request_approved', 'the requester is told');
select throws_ok($$ select withdraw_request(pg_temp.v('r'), pg_temp.lock('r'), 'Changed my mind') $$, '22023', 'request_locked', 'an approved request cannot be withdrawn');

-- Return, edit and resubmit
insert into t select 'r2', save_request(pg_temp.v('org-a'), null, pg_temp.v('cat'), pg_temp.v('FLD'), 'Pens', 'For the office', null, '{}', '[{"description":"Pens","quantity":1,"unit_price_minor":50000}]', null) ->> 'id';
select submit_request(pg_temp.v('r2'), 1);
select is(jsonb_array_length(get_request(pg_temp.v('r2')) -> 'steps'), 1, 'below the threshold there is one step');
select pg_temp.login(2);
select decide_request(pg_temp.step('r2'), pg_temp.lock('r2'), 'return', 'Say which pens');
select pg_temp.login(4);
select is((select returned from my_work(pg_temp.v('org-a'))), 1::bigint, 'returned work is counted');
select save_request(pg_temp.v('org-a'), pg_temp.v('r2'), pg_temp.v('cat'), pg_temp.v('FLD'), 'Blue pens', 'For the office', null, '{}', '[{"description":"Blue pens","quantity":1,"unit_price_minor":150000}]', pg_temp.lock('r2'));
select submit_request(pg_temp.v('r2'), pg_temp.lock('r2'));
select is(jsonb_array_length(get_request(pg_temp.v('r2')) -> 'steps'), 2, 'resubmitting starts a new run with the new amount');
select matches(get_request(pg_temp.v('r2')) ->> 'number', '-0002$', 'the number stays the same');
reset role;
select is((select string_agg(status, ',' order by run_no) from approval_runs where request_id = pg_temp.v('r2')), 'returned,active', 'earlier runs are kept');
select is((select snapshot ->> 'title' from approval_runs where request_id = pg_temp.v('r2') and run_no = 1), 'Pens', 'what was first submitted is kept');
select throws_ok($$ update approval_actions set action = 'reject' $$, '42501', null, 'decisions cannot change');
select throws_ok($$ delete from request_events $$, '42501', null, 'the timeline cannot change');

-- Leavers lose their say at once; reassigning unblocks.
set local role authenticated;
select pg_temp.login(1);
select set_member_status(pg_temp.v('org-a'), pg_temp.v('m3'), 'suspended', 'On leave');
select pg_temp.login(3);
select throws_ok($$ select get_request(pg_temp.v('r2')) $$, 'P0002', 'not_found', 'a suspended approver sees nothing');
select pg_temp.login(2);
select decide_request(pg_temp.step('r2'), pg_temp.lock('r2'), 'approve', null);
select decide_request(pg_temp.step('r2'), pg_temp.lock('r2'), 'approve', null);
select throws_ok($$ select reassign_step(pg_temp.step('r2'), pg_temp.v('m7'), 'Approver away') $$, '42501', 'not_allowed', 'approvers cannot reassign');
select pg_temp.login(1, 'aal1');
select throws_ok($$ select reassign_step(pg_temp.step('r2'), pg_temp.v('m7'), 'Approver away') $$, '42501', 'mfa_required', 'reassigning needs MFA');
select pg_temp.login(1);
select throws_ok($$ select reassign_step(pg_temp.step('r2'), pg_temp.v('m7'), 'Approver away') $$, '22023', 'cannot_reassign', 'only to someone who may approve');
select throws_ok($$ select reassign_step(pg_temp.step('r2'), pg_temp.v('m4'), 'Approver away') $$, '22023', 'cannot_reassign', 'never to the requester');
select grant_role(pg_temp.v('org-a'), pg_temp.v('m7'), pg_temp.v('approver'));
select lives_ok($$ select reassign_step(pg_temp.step('r2'), pg_temp.v('m7'), 'Approver away') $$, 'reassigns');
select pg_temp.login(7);
select decide_request(pg_temp.step('r2'), pg_temp.lock('r2'), 'approve', null);
select is(get_request(pg_temp.v('r2')) ->> 'status', 'approved', 'earlier approvals still count');

-- An approver's own request needs someone else; too few approvers fails at submission.
select pg_temp.login(2);
insert into t select 'r3', save_request(pg_temp.v('org-a'), null, pg_temp.v('cat'), pg_temp.v('FLD'), 'Own laptop', 'For my work', null, '{}', '[{"description":"Laptop","quantity":1,"unit_price_minor":9000000}]', null) ->> 'id';
select throws_ok($$ select submit_request(pg_temp.v('r3'), 1) $$, '22023', 'not_enough_approvers', 'the requester does not count as an approver');

-- Non-monetary, reject, withdraw
select pg_temp.login(4);
insert into t select 'r4', save_request(pg_temp.v('org-a'), null, pg_temp.v('cat'), pg_temp.v('FLD'), 'Use the hall', 'Training day', null, '{}', '[]', null) ->> 'id';
select submit_request(pg_temp.v('r4'), 1);
select pg_temp.login(2);
select decide_request(pg_temp.step('r4'), pg_temp.lock('r4'), 'approve', null);
select is(get_request(pg_temp.v('r4')) ->> 'status', 'closed', 'nothing to pay closes on approval');
select pg_temp.login(4);
insert into t select 'r5', save_request(pg_temp.v('org-a'), null, pg_temp.v('cat'), pg_temp.v('FLD'), 'Gold pens', 'For the office', null, '{}', '[]', null) ->> 'id';
select submit_request(pg_temp.v('r5'), 1);
select lives_ok($$ select withdraw_request(pg_temp.v('r5'), pg_temp.lock('r5'), 'Not needed') $$, 'withdraws');
select is(get_request(pg_temp.v('r5')) ->> 'status', 'cancelled', 'withdrawn');
select pg_temp.login(2);
select is((select count(*)::int from list_requests(pg_temp.v('org-a'), 'inbox')), 0, 'and leaves the inbox');
select throws_ok($$ select delete_draft(pg_temp.v('r5')) $$, 'P0002', 'not_found', 'others cannot delete');

-- Templates and files
select pg_temp.login(4);
insert into t select 'r6', save_request(pg_temp.v('org-a'), null, pg_temp.v('trip'), pg_temp.v('FLD'), 'Abuja trip', 'Site visit', null, '{"mode":"Boat"}', '[]', null) ->> 'id';
select throws_ok($$ select submit_request(pg_temp.v('r6'), 1) $$, '22023', 'form_invalid', 'answers must match the options');
select save_request(pg_temp.v('org-a'), pg_temp.v('r6'), pg_temp.v('trip'), pg_temp.v('FLD'), 'Abuja trip', 'Site visit', null, '{"mode":"Air"}', '[]', 1);
select throws_ok($$ select submit_request(pg_temp.v('r6'), 2) $$, '22023', 'form_invalid', 'a required file is enforced');
select throws_ok($$ select start_attachment(pg_temp.v('r6'), 'quote', 'x.exe', 'application/x-msdownload', 10) $$, '23514', null, 'unsafe file types fail');
select throws_ok($$ select start_attachment(pg_temp.v('r6'), 'mode', 'x.pdf', 'application/pdf', 10) $$, 'P0002', 'not_found', 'files only go to file questions');
insert into t select 'a', start_attachment(pg_temp.v('r6'), 'quote', 'quote.pdf', 'application/pdf', 10) ->> 'id';
select throws_ok($$ select finish_attachment(pg_temp.v('a'), 10, 'x') $$, '42501', null, 'clients cannot mark a file as checked');
select throws_ok($$ select submit_request(pg_temp.v('r6'), 2) $$, '22023', 'form_invalid', 'an unfinished upload does not count');
select pg_temp.login(2);
select throws_ok($$ select start_attachment(pg_temp.v('r6'), null, 'x.pdf', 'application/pdf', 10) $$, 'P0002', 'not_found', 'others cannot add files');
select is((select count(*)::int from get_pending_attachment(pg_temp.v('a'))), 0, 'others cannot see uploads');
reset role;
select finish_attachment(pg_temp.v('a'), 12, 'abc');
set local role authenticated;
select pg_temp.login(2);
select throws_ok($$ select * from get_attachment(pg_temp.v('a')) $$, 'P0002', 'not_found', 'a draft file is private');
select pg_temp.login(4);
select lives_ok($$ select submit_request(pg_temp.v('r6'), 2) $$, 'complete form submits');
select throws_ok($$ select remove_attachment(pg_temp.v('a')) $$, '22023', 'request_locked', 'files are fixed while pending');
select pg_temp.login(2);
select is((select file_name from get_attachment(pg_temp.v('a'))), 'quote.pdf', 'the approver can open it');
select decide_request(pg_temp.step('r6'), pg_temp.lock('r6'), 'return', 'Newer quote please');
select pg_temp.login(4);
select is(remove_attachment(pg_temp.v('a')), null, 'a file approvers saw is kept in storage');
select is(jsonb_array_length(get_request(pg_temp.v('r6')) -> 'attachments'), 0, 'but no longer shown');
select pg_temp.login(1);
select save_template(pg_temp.v('org-a'), pg_temp.v('tpl'), 'request', 'Trip', '[]', 1);
select pg_temp.login(4);
select throws_ok($$ select submit_request(pg_temp.v('r6'), pg_temp.lock('r6')) $$, '22023', 'template_changed', 'a changed template must be reviewed first');

select mark_notifications_read(pg_temp.v('org-a'));
select is((select unread from my_work(pg_temp.v('org-a'))), 0::bigint, 'notifications can be cleared');
select pg_temp.login(2);
select ok((select unread from my_work(pg_temp.v('org-a'))) > 0, 'without clearing anyone else''s');
select * from finish();
rollback;
