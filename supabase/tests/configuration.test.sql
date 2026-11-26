begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(54);

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
select throws_ok($$ select save_template(pg_temp.v('org-a'), null, 'request', 'X1', '[]', null) $$, '42501', 'not_allowed', 'staff cannot configure');
select throws_ok($$ select * from setup_warnings(pg_temp.v('org-a')) $$, '42501', 'not_allowed', 'staff cannot see setup warnings');
select throws_ok($$ select * from list_audit(pg_temp.v('org-a')) $$, '42501', 'not_allowed', 'staff cannot read the audit log');
select throws_ok($$ select * from number_counters $$, '42501', null, 'counters are private');
select throws_ok($$ select app.next_number(pg_temp.v('org-a'), 'request') $$, '42501', null, 'clients cannot use up numbers');
select pg_temp.login(5);
select throws_ok($$ select save_category(pg_temp.v('org-a'), null, 'X1', 'XX', 'both', true, null, null, '{}', '[]') $$, '42501', 'not_allowed', 'another organisation cannot configure');
select is((select count(*)::int from number_sequences), 4, 'another organisation is invisible');
select pg_temp.login(1, 'aal1');
select throws_ok($$ select save_numbering(pg_temp.v('org-a'), 'request', 'RQ', 'year', 4::smallint) $$, '42501', 'mfa_required', 'configuration needs MFA');
select pg_temp.login(1);
select lives_ok($$ select save_numbering(pg_temp.v('org-a'), 'request', 'rq', 'never', 5::smallint) $$, 'numbering changes');
select throws_ok($$ select save_numbering(pg_temp.v('org-a'), 'report', 'RQ', 'year', 4::smallint) $$, '23505', null, 'prefixes are unique');
reset role;
select is(app.next_number(pg_temp.v('org-a'), 'request'), 'RQ-00001', 'new format applies');
set local role authenticated;

-- Templates
insert into t select 'tpl', save_template(pg_temp.v('org-a'), null, 'request', 'Basic',
  '[{"key":"why","label":"Why","type":"long_text","required":true}]', null) ->> 'id';
select throws_ok($$ select save_template(pg_temp.v('org-a'), null, 'request', 'basic', '[]', null) $$, '23505', null, 'template names are unique');
select throws_ok($$ select save_template(pg_temp.v('org-a'), null, 'request', 'Bad', '[{"key":"a","label":"A","type":"script","required":true}]', null) $$, '22023', 'invalid_fields', 'unknown field types fail');
select throws_ok($$ select save_template(pg_temp.v('org-a'), null, 'request', 'Bad', '[{"key":"a","label":"A","type":"date","required":true},{"key":"a","label":"B","type":"date","required":true}]', null) $$, '22023', 'invalid_fields', 'field keys are unique');
select throws_ok($$ select save_template(pg_temp.v('org-a'), null, 'request', 'Bad', '[{"key":"a","label":"A","type":"dropdown","required":true}]', null) $$, '22023', 'invalid_fields', 'dropdowns need options');
select throws_ok($$ select save_template(pg_temp.v('org-a'), null, 'request', 'Bad', '[7]', null) $$, '22023', 'invalid_fields', 'fields must be objects');
select is(save_template(pg_temp.v('org-a'), pg_temp.v('tpl'), 'request', 'Basic two',
  '[{"key":"why","label":"Why","type":"long_text","required":true}]', 1) ->> 'version', '1', 'renaming does not publish');
select is(save_template(pg_temp.v('org-a'), pg_temp.v('tpl'), 'request', 'Basic two', '[]', 1) ->> 'version', '2', 'changing fields publishes a version');
select throws_ok($$ select save_template(pg_temp.v('org-a'), pg_temp.v('tpl'), 'request', 'Old', '[]', 1) $$, '22023', 'stale_version', 'an outdated editor cannot overwrite');
select is((select fields -> 0 ->> 'key' from template_versions where template_id = pg_temp.v('tpl') and version = 1), 'why', 'version one is kept');
reset role;
select throws_ok($$ update template_versions set fields = '[]' $$, '42501', 'version_immutable', 'published templates cannot change');
set local role authenticated;

-- Workflows
select throws_ok($$ select save_workflow(pg_temp.v('org-a'), null, 'request', 'Bad', '[]', null) $$, '22023', 'invalid_steps', 'a workflow needs a step');
select throws_ok($$ select save_workflow(pg_temp.v('org-a'), null, 'request', 'Bad', '[{"name":"Big","approver_type":"category_approvers","min_amount_minor":100}]', null) $$, '22023', 'step_always_needed', 'small amounts still need approval');
select throws_ok($$ select save_workflow(pg_temp.v('org-a'), null, 'report', 'Bad', '[{"name":"Step","approver_type":"category_approvers"}]', null) $$, '22023', 'invalid_steps', 'reports have no category approvers');
select throws_ok(format($$ select save_workflow(pg_temp.v('org-a'), null, 'request', 'Bad', '[{"name":"Step","approver_type":"role","role_id":"%s"}]', null) $$, pg_temp.v('b-finance')), '22023', 'invalid_steps', 'roles from another organisation fail');
select throws_ok(format($$ select save_workflow(pg_temp.v('org-a'), null, 'request', 'Bad', '[{"name":"Step","approver_type":"member","role_id":"%s","membership_id":"%s"}]', null) $$, pg_temp.v('finance'), pg_temp.v('m2')), '23514', null, 'a step has one kind of approver');
insert into t select 'wf', save_workflow(pg_temp.v('org-a'), null, 'request', 'Two step', format(
  '[{"name":"First","approver_type":"category_approvers"},{"name":"Head","approver_type":"role","role_id":"%s","min_amount_minor":5000000,"required_approvals":1}]', pg_temp.v('finance'))::jsonb, null) ->> 'id';
select is((select string_agg(s.name, ',' order by s.position) from workflow_steps s join workflows w on w.current_version_id = s.workflow_version_id where w.id = pg_temp.v('wf')), 'First,Head', 'step order is kept');
select is(save_workflow(pg_temp.v('org-a'), pg_temp.v('wf'), 'request', 'Two step', format(
  '[{"name":"First","approver_type":"category_approvers"},{"name":"Head","approver_type":"role","role_id":"%s","min_amount_minor":5000000,"required_approvals":1}]', pg_temp.v('finance'))::jsonb, 1) ->> 'version', '1', 'unchanged steps do not publish');
select is(save_workflow(pg_temp.v('org-a'), pg_temp.v('wf'), 'request', 'Two step', format(
  '[{"name":"First","approver_type":"category_approvers"},{"name":"Head","approver_type":"role","role_id":"%s","min_amount_minor":9000000}]', pg_temp.v('finance'))::jsonb, 1) ->> 'version', '2', 'a new threshold publishes');
reset role;
select throws_ok($$ delete from workflow_steps $$, '42501', 'version_immutable', 'published steps cannot change');
set local role authenticated;

-- Categories
select throws_ok(format($$ select save_category(pg_temp.v('org-a'), null, 'Travel', 'TRV', 'both', true, null, null, '{}', '[{"role_id":"%s"}]') $$, pg_temp.v('b-approver')), 'P0002', 'not_found', 'approvers from another organisation fail');
select throws_ok(format($$ select save_category(pg_temp.v('org-a'), null, 'Travel', 'TRV', 'both', true, null, null, '{}', '[{"role_id":"%s","membership_id":"%s"}]') $$, pg_temp.v('approver'), pg_temp.v('m2')), 'P0002', 'not_found', 'an approver is a person or a role');
insert into t select 'cat', save_category(pg_temp.v('org-a'), null, 'Travel', 'trv', 'both', true, pg_temp.v('tpl'), pg_temp.v('wf'),
  array[pg_temp.v('FLD')], jsonb_build_array(jsonb_build_object('membership_id', pg_temp.v('m2'))))::text;
select throws_ok($$ select archive_template(pg_temp.v('org-a'), pg_temp.v('tpl')) $$, '22023', 'template_in_use', 'a used template cannot be archived');
select throws_ok($$ select archive_workflow(pg_temp.v('org-a'), pg_temp.v('wf')) $$, '22023', 'workflow_in_use', 'a used workflow cannot be archived');
select throws_ok($$ select archive_department(pg_temp.v('org-a'), pg_temp.v('FLD')) $$, '22023', 'department_in_use', 'a department a category depends on cannot be archived');
select is((select array_agg(code || ':' || found || '/' || needed order by code, subject) from setup_warnings(pg_temp.v('org-a'))),
  array['category_approvers:1/2', 'department_head:0/1', 'department_head:0/1', 'payers:0/2', 'workflow_step:0/1'], 'setup warnings');
select is((select string_agg(name, ',') from list_approvers(pg_temp.v('org-a'), 'requests.approve')), 'User 2', 'only people with permission are offered as approvers');
select throws_ok($$ select * from list_approvers(pg_temp.v('org-a'), 'audit.view') $$, '42501', 'not_allowed', 'other permissions cannot be listed');

-- Assigning someone who may not approve does not count; a second real approver does.
select save_category(pg_temp.v('org-a'), pg_temp.v('cat'), 'Travel', 'TRV', 'both', true, pg_temp.v('tpl'), pg_temp.v('wf'), array[pg_temp.v('FLD')],
  jsonb_build_array(jsonb_build_object('membership_id', pg_temp.v('m2')), jsonb_build_object('membership_id', pg_temp.v('m4'))));
select is((select found from setup_warnings(pg_temp.v('org-a')) where code = 'category_approvers'), 1, 'assignment without permission does not count');
select grant_role(pg_temp.v('org-a'), pg_temp.v('m3'), pg_temp.v('approver'));
select save_category(pg_temp.v('org-a'), pg_temp.v('cat'), 'Travel', 'TRV', 'both', true, pg_temp.v('tpl'), pg_temp.v('wf'), array[pg_temp.v('FLD')],
  jsonb_build_array(jsonb_build_object('role_id', pg_temp.v('approver'), 'department_id', pg_temp.v('FIN'))));
select is((select found from setup_warnings(pg_temp.v('org-a')) where code = 'category_approvers'), 0, 'approvers for another department do not count');
select save_category(pg_temp.v('org-a'), pg_temp.v('cat'), 'Travel', 'TRV', 'both', true, pg_temp.v('tpl'), pg_temp.v('wf'), array[pg_temp.v('FLD')],
  jsonb_build_array(jsonb_build_object('role_id', pg_temp.v('approver')), jsonb_build_object('membership_id', pg_temp.v('m3'))));
select is((select count(*)::int from setup_warnings(pg_temp.v('org-a')) where code = 'category_approvers'), 0, 'two approvers are enough');
select set_member_status(pg_temp.v('org-a'), pg_temp.v('m3'), 'left', 'Resigned');
select is((select count(*)::int from category_approvers), 1, 'leavers stop being approvers');
select throws_ok($$ select add_starter_configuration(pg_temp.v('org-a')) $$, '22023', 'already_configured', 'the starter set never overwrites');

insert into t select 'lead', save_role(pg_temp.v('org-a'), null, 'Lead', '[{"key":"requests.approve","scope":"category"}]')::text;
select save_workflow(pg_temp.v('org-a'), null, 'request', 'Lead only', jsonb_build_array(jsonb_build_object('name', 'Lead', 'approver_type', 'role', 'role_id', pg_temp.v('lead'))), null);
select throws_ok($$ select archive_role(pg_temp.v('org-a'), pg_temp.v('lead')) $$, '22023', 'role_in_use', 'a role in a workflow cannot be archived');

-- Audit
select is((select max(total)::int from list_audit(pg_temp.v('org-a'), 'travel updated')), 3, 'audit search');
select is((select count(*)::int from list_audit(pg_temp.v('org-a'), p_from => (now() at time zone 'Africa/Lagos')::date + 1)), 0, 'audit date filter');
select is((select count(*)::int from list_audit(pg_temp.v('org-a'), p_person => '00000000-0000-0000-0000-000000000004')), 0, 'audit person filter');

select pg_temp.login(5);
select lives_ok($$ select add_starter_configuration(pg_temp.v('org-b')) $$, 'an empty organisation can use the starter set');
select is((select string_agg(f ->> 'key', ',') from templates t join template_versions v on v.id = t.current_version_id,
  jsonb_array_elements(v.fields) f where t.org_id = pg_temp.v('org-b') and t.name = 'General request'),
  'supplier,quotation', 'the starter request does not repeat purpose');
select * from finish();
rollback;
