-- Delivery Tartous: controlled permanent deletion for managed staff accounts.
-- The caller can only remove accounts in their role scope, and historical/financial
-- records are deliberately preserved by blocking deletion once they exist.

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

  if exists (
    select 1
    from public.orders o
    where o.created_by_user_id = p_user_id
    limit 1
  ) then
    raise exception 'This account has created orders and must be deactivated instead' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.pending_account_activations pa
    where pa.created_by_user_id = p_user_id
    limit 1
  ) then
    raise exception 'This account has created pending accounts and must be deactivated instead' using errcode = '22023';
  end if;

  if v_target.role = 'captain'::public.app_role then
    if exists (
      select 1
      from public.orders o
      where o.assigned_captain_id = p_user_id
        and o.status in (
          'assigned'::public.order_status,
          'received'::public.order_status,
          'in_delivery'::public.order_status
        )
      limit 1
    ) then
      raise exception 'A captain with active delivery orders cannot be deleted' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.financial_ledger fl
      where fl.captain_id = p_user_id
      limit 1
    ) then
      raise exception 'A captain with financial records cannot be deleted; deactivate the account instead' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.captain_custody cc
      where cc.captain_id = p_user_id
      limit 1
    ) then
      raise exception 'A captain with custody records cannot be deleted; return custody and deactivate the account instead' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1
    from public.captain_custody cc
    where cc.assigned_by_user_id = p_user_id
       or cc.returned_by_user_id = p_user_id
    limit 1
  ) then
    raise exception 'This account has custody history and must be deactivated instead' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.captain_payouts cp
    where cp.captain_id = p_user_id
       or cp.paid_by_user_id = p_user_id
    limit 1
  ) then
    raise exception 'This account has payout records and must be deactivated instead' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    'managed_user_deleted',
    'profile',
    p_user_id,
    jsonb_build_object(
      'email', v_target.email,
      'role', v_target.role::text,
      'deleted_by_role', private.current_user_role()::text
    )
  );

  -- Activated pending rows reference auth.users with ON DELETE RESTRICT.
  -- Remove only the target's activation record before deleting the Auth user.
  delete from public.pending_account_activations
  where auth_user_id = p_user_id;

  delete from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Auth account was not found' using errcode = 'P0002';
  end if;

  return p_user_id;
end;
$$;

create or replace function public.delete_managed_user(
  p_user_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.delete_managed_user(p_user_id)
$$;

alter function private.delete_managed_user(uuid) owner to postgres;
alter function public.delete_managed_user(uuid) owner to postgres;

revoke all on function private.delete_managed_user(uuid) from public, anon;
revoke all on function public.delete_managed_user(uuid) from public, anon;
grant execute on function private.delete_managed_user(uuid) to authenticated;
grant execute on function public.delete_managed_user(uuid) to authenticated;
