-- The starter request template asked why the request is needed, which Purpose already covers.

create or replace function public.add_starter_configuration(p_org uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_template uuid; v_workflow uuid; v_role uuid;
begin
  perform app.require_perm(p_org, 'config.manage');
  perform app.lock_org(p_org);
  if exists (select 1 from public.categories where org_id = p_org)
    or exists (select 1 from public.templates where org_id = p_org)
    or exists (select 1 from public.workflows where org_id = p_org) then
    raise exception 'already_configured' using errcode = '22023';
  end if;
  v_template := (public.save_template(p_org, null, 'request', 'General request', '[
    {"key":"supplier","label":"Preferred supplier","help":"Who you would like to buy from, if you have someone in mind.","type":"short_text","required":false},
    {"key":"quotation","label":"Quotation","help":"The supplier''s price for these items, such as a quote or proforma invoice. A photo is fine.","type":"file","required":false}]', null) ->> 'id')::uuid;
  perform public.save_template(p_org, null, 'expense_report', 'Monthly expense report', '[
    {"key":"summary","label":"Summary of the month","type":"long_text","required":true},
    {"key":"variances","label":"Unusual or unplanned spending","type":"long_text","required":false}]', null);
  perform public.save_template(p_org, null, 'narrative_report', 'Monthly narrative report', '[
    {"key":"achievements","label":"Key achievements","type":"long_text","required":true},
    {"key":"challenges","label":"Challenges","type":"long_text","required":true},
    {"key":"next_month","label":"Plan for next month","type":"long_text","required":true}]', null);
  v_workflow := (public.save_workflow(p_org, null, 'request', 'Standard approval',
    '[{"name":"Approval","approver_type":"category_approvers","required_approvals":1}]', null) ->> 'id')::uuid;
  select id into v_role from public.roles where org_id = p_org and system_key = 'finance' and archived_at is null;
  if v_role is not null then
    perform public.save_workflow(p_org, null, 'report', 'Finance review', jsonb_build_array(jsonb_build_object(
      'name', 'Finance review', 'approver_type', 'role', 'role_id', v_role, 'required_approvals', 1)), null);
  end if;
  select id into v_role from public.roles where org_id = p_org and system_key = 'approver' and archived_at is null;
  perform public.save_category(p_org, null, c.name, c.code, 'both', true, v_template, v_workflow, '{}',
    case when v_role is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('role_id', v_role)) end)
  from (values ('Office supplies', 'OFF'), ('Travel and transport', 'TRV'), ('Equipment', 'EQP'),
    ('Training and events', 'TRN'), ('General purchases', 'GEN')) c (name, code);
end $$;

-- Publishes the same change wherever the starter template was never edited. Earlier versions stay
-- as they were for the requests that used them.
do $$
declare t record; v_new uuid;
begin
  for t in
    select x.id, x.org_id, x.name, v.version, v.published_by
    from public.templates x join public.template_versions v on v.id = x.current_version_id
    where x.kind = 'request' and x.archived_at is null and v.version = 1 and v.fields = '[
    {"key":"justification","label":"Why is this needed?","type":"long_text","required":true},
    {"key":"supplier","label":"Preferred supplier","type":"short_text","required":false},
    {"key":"quotation","label":"Quotation","type":"file","required":false}]'::jsonb
  loop
    insert into public.template_versions (org_id, template_id, version, fields, published_by)
      values (t.org_id, t.id, t.version + 1, '[
    {"key":"supplier","label":"Preferred supplier","help":"Who you would like to buy from, if you have someone in mind.","type":"short_text","required":false},
    {"key":"quotation","label":"Quotation","help":"The supplier''s price for these items, such as a quote or proforma invoice. A photo is fine.","type":"file","required":false}]', t.published_by) returning id into v_new;
    update public.templates set current_version_id = v_new where id = t.id;
    perform app.write_audit(t.org_id, 'template.published', 'template', t.id,
      jsonb_build_object('name', t.name), jsonb_build_object('name', t.name, 'version', t.version + 1),
      'System update: removed a question that repeated Purpose');
  end loop;
end $$;
