-- Delivery Tartous: fix the Owner-only full application reset.
-- Preserve the Owner identity and authorization catalog; remove operational data,
-- office settings, non-owner users, and all linked profile data.

create or replace function public.reset_application_data(
  p_current_password text
)
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

  if not coalesce((
    select p.is_active
    from public.profiles p
    where p.id = v_owner_id
  ), false) then
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

  -- Delete child records first because these relations use RESTRICT/NO ACTION.
  delete from public.financial_adjustments;
  delete from public.payout_reversal_items;
  delete from public.admin_correction_cases;
  delete from public.captain_payout_items;
  delete from public.captain_payouts;
  delete from public.financial_ledger;
  delete from public.order_status_history;
  delete from public.order_stops;
  delete from public.orders;
  delete from public.captain_custody;
  delete from public.pending_captain_custody;
  delete from public.pending_account_activations;
  delete from public.office_expenses;
  delete from public.office_settings;
  delete from public.push_tokens;
  delete from public.captain_status;
  delete from public.user_permission_overrides;
  delete from public.audit_logs;

  -- Profiles cascade from auth.users; the Owner is retained.
  delete from auth.users
  where id <> v_owner_id;
end;
$$;

alter function public.reset_application_data(text) owner to postgres;
revoke all on function public.reset_application_data(text) from public, anon;
grant execute on function public.reset_application_data(text) to authenticated;
