-- Delivery Tartous: permanently remove a managed account and all operational,
-- financial, custody, payout, correction, activation, and audit records linked to it.
-- Role scope remains unchanged: admins delete captains/supervisors; supervisors delete captains.

create or replace function private.delete_managed_user(
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_can_manage_users boolean := private.has_permission('manage_users');
  v_can_manage_captains boolean := private.has_permission('manage_captains');
  v_order_ids uuid[] := '{}'::uuid[];
  v_ledger_ids uuid[] := '{}'::uuid[];
  v_payout_ids uuid[] := '{}'::uuid[];
  v_correction_ids uuid[] := '{}'::uuid[];
begin
  if p_user_id is null then
    raise exception 'A user id is required' using errcode = '22023';
  end if;

  if not v_can_manage_users and not v_can_manage_captains then
    raise exception 'Current user is not allowed to delete managed accounts' using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot delete your own account' using errcode = '42501';
  end if;

  select *
  into v_target
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile was not found' using errcode = 'P0002';
  end if;

  if private.is_owner(p_user_id) then
    raise exception 'The Owner account is protected' using errcode = '42501';
  end if;

  if v_target.role = 'supervisor'::public.app_role then
    if not v_can_manage_users then
      raise exception 'Only an admin can delete a supervisor account' using errcode = '42501';
    end if;
  elsif v_target.role = 'captain'::public.app_role then
    if not v_can_manage_users and not v_can_manage_captains then
      raise exception 'Current user is not allowed to delete captain accounts' using errcode = '42501';
    end if;
  else
    raise exception 'Admin accounts cannot be deleted from user management' using errcode = '42501';
  end if;

  select coalesce(array_agg(o.id), '{}'::uuid[])
  into v_order_ids
  from public.orders o
  where o.created_by_user_id = p_user_id
     or o.assigned_captain_id = p_user_id;

  select coalesce(array_agg(fl.id), '{}'::uuid[])
  into v_ledger_ids
  from public.financial_ledger fl
  where fl.captain_id = p_user_id
     or fl.order_id = any(v_order_ids);

  select coalesce(array_agg(distinct cp.id), '{}'::uuid[])
  into v_payout_ids
  from public.captain_payouts cp
  left join public.captain_payout_items cpi on cpi.payout_id = cp.id
  where cp.captain_id = p_user_id
     or cp.paid_by_user_id = p_user_id
     or cpi.financial_ledger_id = any(v_ledger_ids);

  select coalesce(array_agg(distinct acc.id), '{}'::uuid[])
  into v_correction_ids
  from public.admin_correction_cases acc
  where acc.captain_id = p_user_id
     or acc.created_by = p_user_id
     or acc.executed_by = p_user_id
     or acc.order_id = any(v_order_ids)
     or acc.payout_id = any(v_payout_ids);

  delete from public.financial_adjustments fa
  where fa.captain_id = p_user_id
     or fa.created_by = p_user_id
     or fa.correction_case_id = any(v_correction_ids)
     or fa.financial_ledger_id = any(v_ledger_ids)
     or fa.order_id = any(v_order_ids)
     or fa.payout_id = any(v_payout_ids);

  delete from public.payout_reversal_items pri
  where pri.captain_id = p_user_id
     or pri.created_by = p_user_id
     or pri.correction_case_id = any(v_correction_ids)
     or pri.financial_ledger_id = any(v_ledger_ids)
     or pri.payout_id = any(v_payout_ids);

  delete from public.admin_correction_cases
  where id = any(v_correction_ids);

  delete from public.captain_payout_items cpi
  where cpi.payout_id = any(v_payout_ids)
     or cpi.financial_ledger_id = any(v_ledger_ids);

  delete from public.captain_payouts
  where id = any(v_payout_ids);

  delete from public.financial_ledger
  where id = any(v_ledger_ids);

  delete from public.captain_custody cc
  where cc.captain_id = p_user_id
     or cc.assigned_by_user_id = p_user_id
     or cc.returned_by_user_id = p_user_id;

  delete from public.orders
  where id = any(v_order_ids);

  delete from public.pending_account_activations pa
  where pa.auth_user_id = p_user_id
     or pa.created_by_user_id = p_user_id;

  delete from public.audit_logs al
  where al.actor_user_id = p_user_id
     or (al.entity_type = 'profile' and al.entity_id = p_user_id)
     or (al.entity_type = 'order' and al.entity_id = any(v_order_ids))
     or (al.entity_type in ('financial_ledger', 'financial_adjustment') and al.entity_id = any(v_ledger_ids))
     or (al.entity_type = 'captain_payout' and al.entity_id = any(v_payout_ids))
     or (al.entity_type = 'admin_correction_case' and al.entity_id = any(v_correction_ids));

  delete from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Auth account was not found' using errcode = 'P0002';
  end if;

  return p_user_id;
end;
$$;

alter function private.delete_managed_user(uuid) owner to postgres;
revoke all on function private.delete_managed_user(uuid) from public, anon;
grant execute on function private.delete_managed_user(uuid) to authenticated;
