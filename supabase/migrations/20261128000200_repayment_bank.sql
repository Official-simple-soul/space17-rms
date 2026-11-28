-- Bank details for repaying someone: shown masked to whoever may repay, revealed in full only on request and recorded.

create function public.reveal_repayment_account(p_line uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare e public.expense_lines; v_number text; b public.bank_accounts; v_me uuid;
begin
  select * into e from public.expense_lines where id = p_line;
  if e.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.require_perm(e.org_id, 'payments.record');
  v_me := app.membership_id(e.org_id);
  if v_me in (e.paid_by_membership_id, e.entered_by) then raise exception 'own_payment' using errcode = '42501'; end if;
  if not app.owes_repayment(e) then raise exception 'not_payable' using errcode = '22023'; end if;
  select * into b from public.bank_accounts where membership_id = e.paid_by_membership_id;
  select decrypted_secret into v_number from vault.decrypted_secrets where id = b.secret_id;
  if v_number is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform app.write_audit(e.org_id, 'bank_details.revealed', 'bank_account', e.paid_by_membership_id, null,
    jsonb_build_object('expense', e.description, 'owner', app.member_name(e.paid_by_membership_id), 'last_digits', b.last_digits));
  return v_number;
end $$;

-- The masked details, for the repayment panel.
create function public.repayment_account(p_line uuid)
returns table (bank_name text, account_name text, last_digits text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare e public.expense_lines; v_me uuid;
begin
  select * into e from public.expense_lines where id = p_line;
  if e.id is null or not app.can_view_expense(e) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_me := app.membership_id(e.org_id);
  if not app.has_perm(e.org_id, 'payments.record') or v_me in (e.paid_by_membership_id, e.entered_by) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select b.bank_name, b.account_name, b.last_digits, b.updated_at
    from public.bank_accounts b where b.membership_id = e.paid_by_membership_id;
end $$;

revoke execute on function public.reveal_repayment_account(uuid), public.repayment_account(uuid) from public, anon, authenticated;
grant execute on function public.reveal_repayment_account(uuid), public.repayment_account(uuid) to authenticated;
