-- Delivery Tartous: bounded keyset pagination for pending-account management.
-- The client asks for one extra row to determine whether a next page exists.

create or replace function private.list_pending_accounts(
  p_limit integer default 25,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns setof public.pending_account_activations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := private.has_permission('manage_users');
  v_can_manage_captains boolean := private.has_permission('manage_captains');
  -- One extra row is allowed only to detect whether the 25-row client page has a successor.
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 26));
begin
  if not v_is_admin and not v_can_manage_captains then
    raise exception 'Current user is not allowed to list pending accounts' using errcode = '42501';
  end if;

  if (p_cursor_created_at is null) <> (p_cursor_id is null) then
    raise exception 'Pending account cursor must include created_at and id together' using errcode = '22023';
  end if;

  return query
  select pending.*
  from public.pending_account_activations as pending
  where (v_is_admin or pending.role = 'captain'::public.app_role)
    and pending.activated_at is null
    and pending.cancelled_at is null
    and (
      p_cursor_created_at is null
      or pending.created_at < p_cursor_created_at
      or (pending.created_at = p_cursor_created_at and pending.id < p_cursor_id)
    )
  order by pending.created_at desc, pending.id desc
  limit v_limit;
end;
$$;

create or replace function public.list_pending_accounts(
  p_limit integer default 25,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns setof public.pending_account_activations
language sql
security invoker
set search_path = ''
as $$
  select * from private.list_pending_accounts(p_limit, p_cursor_created_at, p_cursor_id)
$$;

revoke all on function private.list_pending_accounts(integer, timestamptz, uuid) from public, anon;
grant execute on function private.list_pending_accounts(integer, timestamptz, uuid) to authenticated;

revoke all on function public.list_pending_accounts(integer, timestamptz, uuid) from public, anon;
grant execute on function public.list_pending_accounts(integer, timestamptz, uuid) to authenticated;
