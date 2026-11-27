begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select * from no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local', now(), 'authenticated', 'authenticated',
  jsonb_build_object('full_name', 'User ' || n) from generate_series(1, 8) n;
create function pg_temp.login(p_n int, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_n,
    'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;
grant execute on function pg_temp.login(int, text) to authenticated, service_role;
grant usage on schema extensions to authenticated, service_role;
create temp table t (k text primary key, v text); grant all on t to authenticated, service_role;
create function pg_temp.v(p text) returns uuid language sql as $$ select v::uuid from t where k = p $$;
create function pg_temp.lock(p text) returns int language sql as $$ select (get_expense(pg_temp.v(p)) ->> 'lock_version')::int $$;
create function pg_temp.st(p text) returns text language sql as $$ select get_expense(pg_temp.v(p)) ->> 'status' $$;
create function pg_temp.rlock(p text) returns int language sql as $$ select (get_report(pg_temp.v(p)) ->> 'lock_version')::int $$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

-- 1 admin, 2 head of Field, 3 finance, 4 staff in Field, 5 other organisation, 6 second staff in Field, 7 head of Office, 8 staff in Lab (no head)
insert into organisations (name, slug) values ('Org A', 'org-a'), ('Org B', 'org-b');
insert into t select slug, id::text from organisations where slug in ('org-a', 'org-b');
select app.seed_roles(pg_temp.v('org-a')); select app.seed_roles(pg_temp.v('org-b'));
insert into memberships (org_id, user_id)
  select pg_temp.v(case when n = 5 then 'org-b' else 'org-a' end), ('00000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 8) n;
insert into t select 'm' || right(user_id::text, 1), id::text from memberships where org_id in (pg_temp.v('org-a'), pg_temp.v('org-b'));
insert into t select system_key, id::text from roles where org_id = pg_temp.v('org-a');
insert into departments (org_id, name, code, created_at) select pg_temp.v('org-a'), n, c, now() - interval '1 year'
  from (values ('Field', 'FLD'), ('Office', 'OFC'), ('Lab', 'LAB')) x (n, c);
insert into t select code, id::text from departments where org_id = pg_temp.v('org-a');
insert into membership_roles (org_id, membership_id, role_id, department_id)
  select pg_temp.v('org-a'), pg_temp.v(m), pg_temp.v(r), pg_temp.v(d)
  from (values ('m1', 'admin', null), ('m2', 'hod', 'FLD'), ('m2', 'staff', null), ('m3', 'finance', null), ('m4', 'staff', null), ('m6', 'staff', null),
    ('m7', 'hod', 'OFC'), ('m8', 'staff', null)) x (m, r, d);
insert into department_members (org_id, department_id, membership_id)
  select pg_temp.v('org-a'), pg_temp.v(d), pg_temp.v(m)
  from (values ('m2', 'FLD'), ('m3', 'FLD'), ('m4', 'FLD'), ('m6', 'FLD'), ('m7', 'OFC'), ('m8', 'LAB')) x (m, d);
insert into membership_roles (org_id, membership_id, role_id)
  select pg_temp.v('org-b'), pg_temp.v('m5'), id from roles where org_id = pg_temp.v('org-b') and system_key = 'admin';
insert into categories (org_id, name) values (pg_temp.v('org-a'), 'Supplies'), (pg_temp.v('org-a'), 'Retired');
insert into t select upper(left(name, 3)), id::text from categories where org_id = pg_temp.v('org-a');
update categories set archived_at = now() where id = pg_temp.v('RET');

create function pg_temp.app_today() returns date language sql as $$ select (now() at time zone 'Africa/Lagos')::date $$;
create function pg_temp.make(p_key text, p_user int, p_price bigint, p_seller text default 'Mama Nkechi', p_days int default 0,
  p_no_receipt boolean default true, p_dept text default 'FLD') returns void language plpgsql as $$
begin
  perform pg_temp.login(p_user);
  insert into t select p_key, save_expense(pg_temp.v('org-a'), null, pg_temp.v('SUP'), pg_temp.v(p_dept), null, pg_temp.app_today() - p_days,
    'Cleaning items', p_seller, 'Wuse market', null, 'department', p_no_receipt, 'Market seller gives none',
    jsonb_build_array(jsonb_build_object('description', 'Soap', 'quantity', 2, 'unit_price_minor', p_price)), null) ->> 'id';
end $$;
-- Adds a checked file the way the server does.
create function pg_temp.receipt(p_key text, p_hash text) returns void language plpgsql as $$
declare v uuid;
begin
  v := (start_expense_file(pg_temp.v(p_key), 'vendor_receipt', 'r.pdf', 'application/pdf', 100) ->> 'id')::uuid;
  insert into t values ('f:' || p_key || ':' || p_hash, v::text);
  reset role;
  perform finish_attachment(v, 100, p_hash);
  set local role authenticated;
end $$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

set local role authenticated;
select pg_temp.login(4);
select throws_ok($$ select * from expense_lines $$, '42501', null, 'expenses cannot be read directly');
select throws_ok($$ select * from reports $$, '42501', null, 'reports cannot be read directly');
select throws_ok($$ select queue_report_reminders() $$, '42501', null, 'reminders are for the server');
select is((select count(*)::int from expense_categories(pg_temp.v('org-a'))), 1, 'archived categories are left out');

-- Drafts and submitting
select lives_ok($$ insert into t select 'blank', save_expense(pg_temp.v('org-a'), null, null, null, null, null, '', '', null, null, 'department', false, null, '[]', null) ->> 'id' $$, 'a draft may be empty');
select throws_ok($$ select submit_expense(pg_temp.v('blank'), 1) $$, '22023', 'department_missing', 'but not submitted');
select lives_ok($$ select delete_expense(pg_temp.v('blank')) $$, 'and can be deleted');
select pg_temp.make('a', 4, 50000);
select pg_temp.login(2);
select throws_ok($$ select get_expense(pg_temp.v('a')) $$, 'P0002', 'not_found', 'the head cannot see a draft');
select pg_temp.login(5);
select throws_ok($$ select save_expense(pg_temp.v('org-a'), null, null, null, null, null, '', '', null, null, 'department', false, null, '[]', null) $$, '42501', 'not_allowed', 'other organisations cannot add');
select pg_temp.login(4);
select throws_ok($$ select save_expense(pg_temp.v('org-a'), null, pg_temp.v('SUP'), pg_temp.v('OFC'), null, null, '', '', null, null, 'department', false, null, '[]', null) $$, '22023', 'department_missing', 'only into your own department');
select throws_ok($$ select save_expense(pg_temp.v('org-a'), null, pg_temp.v('RET'), pg_temp.v('FLD'), null, null, '', '', null, null, 'department', false, null, '[]', null) $$, '22023', 'category_unavailable', 'archived categories are refused');
select throws_ok($$ select save_expense(pg_temp.v('org-a'), null, null, null, null, null, '', '', null, null, 'gift', false, null, '[]', null) $$, '23514', null, 'funding is checked');
select throws_ok($$ select submit_expense(pg_temp.v('a'), 99) $$, '22023', 'stale_expense', 'an outdated page cannot submit');
select is(submit_expense(pg_temp.v('a'), 1), 'submitted', 'staff submit');
select throws_ok($$ select delete_expense(pg_temp.v('a')) $$, '22023', 'expense_locked', 'submitted expenses cannot be deleted');
select is(get_expense(pg_temp.v('a')) ->> 'total_minor', '100000', 'the server adds up the items');
select pg_temp.make('r', 4, 70000, 'Shop', 0, false);
select throws_ok($$ select submit_expense(pg_temp.v('r'), 1) $$, '22023', 'receipt_required', 'a receipt or a reason is needed');
select pg_temp.receipt('r', 'hash-1');
select is(get_expense(pg_temp.v('r')) ->> 'evidence', 'vendor_receipt', 'evidence follows the file');
select is(submit_expense(pg_temp.v('r'), 1), 'submitted', 'with a receipt it goes through');
select throws_ok($$ select start_expense_file(pg_temp.v('r'), 'vendor_receipt', 'r.pdf', 'application/pdf', 100) $$, '22023', 'expense_locked', 'no files while the head decides');
select throws_ok($$ select remove_attachment(pg_temp.v('f:r:hash-1')) $$, '22023', 'request_locked', 'nor removals');
select pg_temp.make('both', 4, 71000);
select pg_temp.receipt('both', 'hash-both');
select throws_ok($$ select submit_expense(pg_temp.v('both'), 1) $$, '22023', 'receipt_conflict', 'cannot claim no receipt and attach one');
select pg_temp.make('old', 4, 1000, 'Old', 400);
select throws_ok($$ select submit_expense(pg_temp.v('old'), 1) $$, '22023', 'invalid_expense_date', 'not over a year old');
select pg_temp.make('future', 4, 1000, 'Future', -1);
select throws_ok($$ select submit_expense(pg_temp.v('future'), 1) $$, '22023', 'invalid_expense_date', 'nor in the future');
select pg_temp.make('lab', 8, 1000, 'Lab', 0, true, 'LAB');
select throws_ok($$ select submit_expense(pg_temp.v('lab'), 1) $$, '22023', 'no_head', 'a department needs a head');

-- Visibility
select pg_temp.login(6);
select throws_ok($$ select get_expense(pg_temp.v('a')) $$, 'P0002', 'not_found', 'colleagues cannot see it');
select throws_ok($$ select save_expense(pg_temp.v('org-a'), pg_temp.v('both'), null, null, null, null, '', '', null, null, 'department', false, null, '[]', 1) $$, 'P0002', 'not_found', 'nor edit a draft');
select pg_temp.login(7);
select throws_ok($$ select get_expense(pg_temp.v('a')) $$, 'P0002', 'not_found', 'nor the head of another department');
select throws_ok($$ select decide_expense(pg_temp.v('a'), 2, 'accept', null) $$, 'P0002', 'not_found', 'who cannot decide it either');
select is((select count(*)::int from list_expenses(pg_temp.v('org-a'), 'inbox')), 0, 'nor see it in a list');
select pg_temp.login(5);
select throws_ok($$ select get_expense(pg_temp.v('a')) $$, 'P0002', 'not_found', 'other organisations see nothing');
select throws_ok($$ select list_expenses(pg_temp.v('org-a'), 'all') $$, '42501', 'not_allowed', 'and cannot list');
select pg_temp.login(3);
select is(pg_temp.st('a'), 'submitted', 'finance can see it');
select throws_ok($$ select decide_expense(pg_temp.v('a'), 2, 'accept', null) $$, '42501', 'not_allowed', 'but not accept it');

-- The head decides
select pg_temp.login(2);
select is((select count(*)::int from list_expenses(pg_temp.v('org-a'), 'inbox')), 2, 'the head sees the inbox');
select is((select expenses_waiting from my_work(pg_temp.v('org-a'))), 2::bigint, 'and the count');
select is((select count(*)::int from ready_expenses(pg_temp.v('org-a'))), 1, 'only lines with a receipt and no flags can be accepted together');
select throws_ok($$ select accept_expenses(pg_temp.v('org-a'), jsonb_build_array(jsonb_build_object('id', pg_temp.v('a'), 'lock_version', 2))) $$, '22023', 'stale_expense', 'a line without a receipt cannot');
select is(accept_expenses(pg_temp.v('org-a'), (select jsonb_agg(x) from ready_expenses(pg_temp.v('org-a')) x)), 1, 'accepting together works');
select is(pg_temp.st('r'), 'accepted', 'and the line joins the report');
insert into t select 'rep', get_expense(pg_temp.v('r')) #>> '{report,id}';
select is((get_report(pg_temp.v('rep')) ->> 'month')::date, date_trunc('month', pg_temp.app_today())::date, 'for its own month');
select throws_ok($$ select decide_expense(pg_temp.v('a'), 2, 'return', '') $$, '22023', 'reason_required', 'returning needs a reason');
select lives_ok($$ select decide_expense(pg_temp.v('a'), 2, 'return', 'Say which shop') $$, 'the head returns it');
select throws_ok($$ select decide_expense(pg_temp.v('a'), 2, 'accept', null) $$, '22023', 'stale_expense', 'a second decision is refused');
select pg_temp.login(4);
select is((select expenses_returned from my_work(pg_temp.v('org-a'))), 1::bigint, 'the enterer is told');
select ok(exists (select 1 from list_notifications(pg_temp.v('org-a')) n where n.type = 'expense_returned' and n.expense_id = pg_temp.v('a')), 'with a notification');
select throws_ok($$ select save_expense(pg_temp.v('org-a'), pg_temp.v('a'), null, null, null, null, '', '', null, null, 'department', true, null, '[]', 3) $$, '22023', 'expense_incomplete', 'a returned expense stays complete');
select is(submit_expense(pg_temp.v('a'), 3), 'submitted', 'and can be sent again');
select pg_temp.login(2);
select lives_ok($$ select decide_expense(pg_temp.v('a'), 4, 'accept', null) $$, 'the head accepts a line without a receipt');
select is(jsonb_array_length(get_report(pg_temp.v('rep')) -> 'lines'), 2, 'the report has both lines');

-- Flags
select pg_temp.make('dup', 6, 70000, ' shop ', 0, false);
select pg_temp.receipt('dup', 'hash-1');
select submit_expense(pg_temp.v('dup'), 1);
select ok(get_expense(pg_temp.v('dup')) -> 'flags' @> '["duplicate", "duplicate_file"]', 'same purchase and same file are flagged');
select pg_temp.login(2);
select is((select count(*)::int from ready_expenses(pg_temp.v('org-a'))), 0, 'and left out of accepting together');
select lives_ok($$ select decide_expense(pg_temp.v('dup'), 2, 'reject', 'Already claimed') $$, 'the head rejects it');
select pg_temp.login(6);
select throws_ok($$ select submit_expense(pg_temp.v('dup'), 3) $$, '22023', 'expense_locked', 'rejected is final');
select pg_temp.make('w', 6, 5500, 'Wale');
select submit_expense(pg_temp.v('w'), 1);
select lives_ok($$ select withdraw_expense(pg_temp.v('w'), 2) $$, 'the enterer can withdraw');

-- A head's own line, evidence added later, and removal
select pg_temp.make('own', 2, 9000, 'Own');
select is(submit_expense(pg_temp.v('own'), 1), 'accepted', 'a head''s own line goes straight in');
select pg_temp.login(6);
select throws_ok($$ select start_expense_file(pg_temp.v('own'), 'vendor_receipt', 'r.pdf', 'application/pdf', 100) $$, 'P0002', 'not_found', 'others cannot add evidence');
select pg_temp.login(4);
select pg_temp.receipt('a', 'hash-late');
select is(get_expense(pg_temp.v('a')) ->> 'evidence', 'vendor_receipt', 'a receipt found later can be added');
select throws_ok($$ select remove_attachment(pg_temp.v('f:a:hash-late')) $$, '22023', 'request_locked', 'but not removed');
select throws_ok($$ select remove_report_line(pg_temp.v('a'), 5, 'I want it out') $$, '42501', 'not_allowed', 'staff cannot take a line out');
select pg_temp.login(2);
select lives_ok($$ select remove_report_line(pg_temp.v('a'), 5, 'Wrong month') $$, 'the head can');
select is(pg_temp.st('a'), 'returned', 'and it goes back to the enterer');

-- Last month's expense
select pg_temp.make('late', 4, 3000, 'Late', extract(day from pg_temp.app_today())::int);
select submit_expense(pg_temp.v('late'), 1);
select pg_temp.login(2);
select decide_expense(pg_temp.v('late'), 2, 'accept', null);
insert into t select 'prev', get_expense(pg_temp.v('late')) #>> '{report,id}';
select is((get_report(pg_temp.v('prev')) ->> 'month')::date, (date_trunc('month', pg_temp.app_today()) - interval '1 month')::date, 'goes into last month''s open report');

-- Reports
select is((select count(*)::int from my_report_months(pg_temp.v('org-a'))), 2, 'the head sees two months');
select is(open_report(pg_temp.v('org-a'), pg_temp.v('FLD'), date_trunc('month', pg_temp.app_today())::date), pg_temp.v('rep'), 'opening again finds the same report');
select throws_ok($$ select open_report(pg_temp.v('org-a'), pg_temp.v('FLD'), '2020-01-01') $$, '22023', 'invalid_month', 'only recent months');
select throws_ok($$ select open_report(pg_temp.v('org-a'), pg_temp.v('OFC'), date_trunc('month', pg_temp.app_today())::date) $$, '42501', 'not_allowed', 'only your department');
select pg_temp.login(7);
select throws_ok($$ select get_report(pg_temp.v('rep')) $$, 'P0002', 'not_found', 'other heads cannot see it');
select pg_temp.login(4);
select throws_ok($$ select get_report(pg_temp.v('rep')) $$, 'P0002', 'not_found', 'nor staff');
select is((select count(*)::int from list_reports(pg_temp.v('org-a'))), 0, 'nor list it');
select pg_temp.login(5);
select throws_ok($$ select list_reports(pg_temp.v('org-a')) $$, '42501', 'not_allowed', 'nor other organisations');
select pg_temp.login(3);
select is((select count(*)::int from list_reports(pg_temp.v('org-a'))), 2, 'finance sees reports');
select throws_ok($$ select submit_report(pg_temp.v('rep'), pg_temp.rlock('rep'), true) $$, '42501', 'not_allowed', 'but does not submit them');
select pg_temp.login(2);
select throws_ok($$ select save_report(pg_temp.v('rep'), 1, '') $$, '22023', 'stale_report', 'an outdated page cannot save');
select save_report(pg_temp.v('rep'), pg_temp.rlock('rep'), '  A quiet month  ');
select is(get_report(pg_temp.v('rep')) ->> 'summary', 'A quiet month', 'the summary is kept');
select throws_ok($$ select submit_report(pg_temp.v('rep'), pg_temp.rlock('rep'), false) $$, '22023', 'missing_evidence', 'missing receipts must be acknowledged');
reset role;
-- Finance reviews, with admins as backup; with neither there is nobody to send it to.
update membership_roles set valid_until = now() - interval '1 second', valid_from = now() - interval '1 day' where membership_id in (pg_temp.v('m3'), pg_temp.v('m1'));
set local role authenticated;
select throws_ok($$ select submit_report(pg_temp.v('rep'), pg_temp.rlock('rep'), true) $$, '22023', 'no_reviewer', 'someone must be able to review');
reset role;
update membership_roles set valid_until = null where membership_id in (pg_temp.v('m3'), pg_temp.v('m1'));
set local role authenticated;
select lives_ok($$ select submit_report(pg_temp.v('rep'), pg_temp.rlock('rep'), true) $$, 'the head submits');
select is(get_report(pg_temp.v('rep')) ->> 'status', 'under_review', 'it waits for review');
select matches(get_report(pg_temp.v('rep')) ->> 'number', '^RPT-', 'with a number');
select throws_ok($$ select save_report(pg_temp.v('rep'), pg_temp.rlock('rep'), '') $$, '22023', 'report_locked', 'it can no longer be edited');
select throws_ok($$ select remove_report_line(pg_temp.v('own'), pg_temp.lock('own'), 'Too late now') $$, '22023', 'report_locked', 'nor lose lines');
select throws_ok($$ select start_expense_file(pg_temp.v('own'), 'vendor_receipt', 'r.pdf', 'application/pdf', 100) $$, '22023', 'expense_locked', 'nor gain evidence');
select pg_temp.login(3);
select ok(exists (select 1 from list_notifications(pg_temp.v('org-a')) n where n.type = 'report_submitted' and n.report_id = pg_temp.v('rep')), 'reviewers are told');
select pg_temp.make('next', 4, 1200, 'Next');
select submit_expense(pg_temp.v('next'), 1);
select pg_temp.login(2);
select decide_expense(pg_temp.v('next'), 2, 'accept', null);
select is((select (get_report((get_expense(pg_temp.v('next')) #>> '{report,id}')::uuid) ->> 'month')::date), (date_trunc('month', pg_temp.app_today()) + interval '1 month')::date, 'later expenses go to the next month');
select is((get_expense(pg_temp.v('next')) ->> 'date')::date, pg_temp.app_today(), 'with their real date');
select ok(get_expense(pg_temp.v('next')) -> 'flags' @> '["other_month"]', 'and a flag');
select throws_ok($$ select submit_report((get_expense(pg_temp.v('next')) #>> '{report,id}')::uuid, (get_report((get_expense(pg_temp.v('next')) #>> '{report,id}')::uuid) ->> 'lock_version')::int, true) $$, '22023', 'invalid_month', 'a future month cannot be submitted');

-- Settings, reminders and records
select throws_ok($$ select set_report_due_day(pg_temp.v('org-a'), 10::smallint) $$, '42501', 'not_allowed', 'heads cannot move deadlines');
select pg_temp.login(1, 'aal1');
select throws_ok($$ select set_report_due_day(pg_temp.v('org-a'), 10::smallint) $$, '42501', 'mfa_required', 'two-step verification is needed');
select pg_temp.login(1);
select throws_ok($$ select set_report_due_day(pg_temp.v('org-a'), 31::smallint) $$, '23514', null, 'the day is checked');
select lives_ok($$ select set_report_due_day(pg_temp.v('org-a'), 10::smallint) $$, 'admins can');
reset role;
update report_periods set due_date = pg_temp.app_today() where id = (select period_id from reports where id = pg_temp.v('prev'));
select ok(queue_report_reminders() >= 1, 'a reminder is sent');
select is(queue_report_reminders(), 0, 'only once');
select ok(exists (select 1 from notifications where membership_id = pg_temp.v('m2') and type = 'report_due_today' and report_id = pg_temp.v('prev')), 'to the head');
select throws_ok($$ update departments set archived_at = now() where id = pg_temp.v('FLD') $$, '22023', 'department_has_expenses', 'a department in use stays');
select throws_ok($$ update expense_events set body = 'x' $$, '42501', null, 'history cannot be changed');
select is((select count(*)::int from public.expense_lines where status in ('accepted') and report_id is null), 0, 'accepted lines always belong to a report');

select * from finish();
rollback;
