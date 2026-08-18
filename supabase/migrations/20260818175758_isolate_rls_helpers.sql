-- Keep RLS helper functions out of the public Data API schema.
-- They remain SECURITY DEFINER only inside the non-exposed private schema.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true
$$;

create or replace function private.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when p.role = 'admin'::public.app_role then true
      when uo.user_id is not null then uo.is_allowed
      else coalesce(rp.is_allowed, false)
    end
    from public.profiles p
    left join public.user_permission_overrides uo
      on uo.user_id = p.id
      and uo.permission_code = required_permission
    left join public.role_permissions rp
      on rp.role = p.role
      and rp.permission_code = required_permission
    where p.id = (select auth.uid())
      and p.is_active = true
  ), false)
$$;

create or replace function private.can_view_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('view_all_orders')
    or (
      private.has_permission('view_own_orders')
      and exists (
        select 1
        from public.orders o
        where o.id = target_order_id
          and o.assigned_captain_id = (select auth.uid())
      )
    )
$$;

alter policy "profiles_select_self_or_authorized_staff"
on public.profiles
using (
  id = (select auth.uid())
  or private.has_permission('manage_users')
  or (role = 'captain'::public.app_role and private.has_permission('assign_captains'))
);

alter policy "role_permissions_select_authorized_staff"
on public.role_permissions
using (private.has_permission('manage_permissions'));

alter policy "user_permission_overrides_select_self_or_authorized_staff"
on public.user_permission_overrides
using (
  user_id = (select auth.uid())
  or private.has_permission('manage_permissions')
);

alter policy "captain_status_select_self_or_assignment_staff"
on public.captain_status
using (
  captain_id = (select auth.uid())
  or private.has_permission('assign_captains')
  or private.has_permission('manage_users')
);

alter policy "orders_select_assigned_captain_or_authorized_staff"
on public.orders
using (private.can_view_order(id));

alter policy "order_history_select_if_order_is_visible"
on public.order_status_history
using (private.can_view_order(order_id));

alter policy "financial_ledger_select_own_or_finance_staff"
on public.financial_ledger
using (
  (captain_id = (select auth.uid()) and private.has_permission('view_own_earnings'))
  or private.has_permission('view_finances')
);

alter policy "audit_logs_select_authorized_staff"
on public.audit_logs
using (private.has_permission('view_audit_logs'));

create policy "captain_status_insert_own_if_permitted"
on public.captain_status
for insert
to authenticated
with check (
  captain_id = (select auth.uid())
  and private.current_user_role() = 'captain'::public.app_role
  and private.has_permission('change_availability')
);

create policy "captain_status_update_own_if_permitted"
on public.captain_status
for update
to authenticated
using (
  captain_id = (select auth.uid())
  and private.current_user_role() = 'captain'::public.app_role
  and private.has_permission('change_availability')
)
with check (
  captain_id = (select auth.uid())
  and private.current_user_role() = 'captain'::public.app_role
  and private.has_permission('change_availability')
);

grant insert, update on public.captain_status to authenticated;

create or replace function public.set_captain_availability(new_availability public.captain_availability)
returns public.captain_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.captain_status;
begin
  if private.current_user_role() is distinct from 'captain'::public.app_role then
    raise exception 'Only an active captain can change captain availability';
  end if;

  if not private.has_permission('change_availability') then
    raise exception 'Current captain is not allowed to change availability';
  end if;

  insert into public.captain_status (captain_id, availability)
  values ((select auth.uid()), new_availability)
  on conflict (captain_id) do update
    set availability = excluded.availability,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.current_user_role() from public, anon, authenticated;
revoke all on function public.has_permission(text) from public, anon, authenticated;
revoke all on function public.can_view_order(uuid) from public, anon, authenticated;
drop function public.current_user_role();
drop function public.has_permission(text);
drop function public.can_view_order(uuid);

revoke all on function private.current_user_role() from public, anon;
revoke all on function private.has_permission(text) from public, anon;
revoke all on function private.can_view_order(uuid) from public, anon;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.can_view_order(uuid) to authenticated;

revoke all on function public.set_captain_availability(public.captain_availability) from public, anon;
grant execute on function public.set_captain_availability(public.captain_availability) to authenticated;
