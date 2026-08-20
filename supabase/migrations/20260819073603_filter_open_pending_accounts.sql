-- Delivery Tartous: return only actionable pending accounts to management screens.
-- Applied historically to the live project; restored here to keep Git migration history complete.

create or replace function private.list_pending_accounts()
returns setof public.pending_account_activations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := private.has_permission('manage_users');
  v_can_manage_captains boolean := private.has_permission('manage_captains');
begin
  if not v_is_admin and not v_can_manage_captains then
    raise exception 'Current user is not allowed to list pending accounts' using errcode = '42501';
  end if;

  return query
  select *
  from public.pending_account_activations
  where (v_is_admin or role = 'captain'::public.app_role)
    and activated_at is null
    and cancelled_at is null
  order by created_at desc;
end;
$$;
