create or replace function public.reset_application_data(p_current_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_password_hash text;
begin
  v_owner_id := private.owner_user_id();

  if (select auth.uid()) is distinct from v_owner_id then
    raise exception 'Only the application Owner can reset application data' using errcode = '42501';
  end if;

  if not coalesce(
    (select p.is_active from public.profiles p where p.id = v_owner_id),
    false
  ) then
    raise exception 'The Owner account must be active' using errcode = '42501';
  end if;

  if nullif(btrim(p_current_password), '') is null then
    raise exception 'Current password is required' using errcode = '22023';
  end if;

  select u.encrypted_password
    into v_password_hash
  from auth.users u
  where u.id = v_owner_id;

  if v_password_hash is null
     or extensions.crypt(p_current_password, v_password_hash) is distinct from v_password_hash then
    raise exception 'Current password is incorrect' using errcode = '28000';
  end if;

  -- Delete dependent financial and operational rows before their parent rows.
  delete from public.treasury_transactions where true;
  delete from public.financial_adjustments where true;
  delete from public.payout_reversal_items where true;
  delete from public.admin_correction_cases where true;
  delete from public.captain_payout_items where true;
  delete from public.captain_payouts where true;
  delete from public.financial_ledger where true;
  delete from public.order_status_history where true;
  delete from public.order_stops where true;
  delete from public.orders where true;
  delete from public.captain_custody where true;
  delete from public.pending_captain_custody where true;
  delete from public.pending_account_activations where true;
  delete from public.office_expenses where true;
  delete from public.office_settings where true;
  delete from public.push_tokens where true;
  delete from public.captain_status where true;
  delete from public.user_permission_overrides where true;
  delete from public.audit_logs where true;

  -- Keep the Owner's auth account and remove all other accounts.
  delete from auth.users
  where id <> v_owner_id;
end;
$$;

alter function public.reset_application_data(text) owner to postgres;
revoke all on function public.reset_application_data(text) from public, anon;
grant execute on function public.reset_application_data(text) to authenticated;
