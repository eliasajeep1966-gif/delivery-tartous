-- Delivery Tartous: authorization catalog, protected helper functions, and RLS policies.
-- Direct client writes are intentionally not granted. Sensitive mutations will use reviewed RPCs.

insert into public.permissions (code, description) values
  ('manage_users', 'Create, update, activate, or deactivate users'),
  ('manage_permissions', 'Change role permissions and user-level permission overrides'),
  ('create_orders', 'Create delivery orders'),
  ('assign_captains', 'Assign an available captain to an order'),
  ('cancel_orders', 'Cancel an active delivery order'),
  ('view_all_orders', 'View all delivery orders and their histories'),
  ('view_finances', 'View all captain and company financial records'),
  ('view_audit_logs', 'View administrative audit logs'),
  ('view_own_orders', 'View orders assigned to the current captain'),
  ('change_availability', 'Change the current captain availability'),
  ('receive_assigned_order', 'Mark an assigned order as received'),
  ('start_assigned_delivery', 'Mark a received order as in delivery'),
  ('complete_assigned_order', 'Mark an in-delivery order as completed'),
  ('mark_assigned_order_false', 'Mark an assigned order as a false order'),
  ('view_own_earnings', 'View financial records belonging to the current captain');

insert into public.role_permissions (role, permission_code, is_allowed)
select 'admin'::public.app_role, p.code, true
from public.permissions p;

insert into public.role_permissions (role, permission_code, is_allowed) values
  ('supervisor', 'create_orders', true),
  ('supervisor', 'assign_captains', true),
  ('supervisor', 'cancel_orders', true),
  ('supervisor', 'view_all_orders', true),
  ('supervisor', 'view_finances', true),
  ('captain', 'view_own_orders', true),
  ('captain', 'change_availability', true),
  ('captain', 'receive_assigned_order', true),
  ('captain', 'start_assigned_delivery', true),
  ('captain', 'complete_assigned_order', true),
  ('captain', 'mark_assigned_order_false', true),
  ('captain', 'view_own_earnings', true);

create or replace function public.current_user_role()
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

create or replace function public.has_permission(required_permission text)
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

create or replace function public.can_view_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('view_all_orders')
    or (
      public.has_permission('view_own_orders')
      and exists (
        select 1
        from public.orders o
        where o.id = target_order_id
          and o.assigned_captain_id = (select auth.uid())
      )
    )
$$;

create or replace function public.set_captain_availability(new_availability public.captain_availability)
returns public.captain_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.captain_status;
begin
  if public.current_user_role() is distinct from 'captain'::public.app_role then
    raise exception 'Only an active captain can change captain availability';
  end if;

  if not public.has_permission('change_availability') then
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

-- RLS is explicit here even though automatic RLS is enabled at the project level.
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.captain_status enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.financial_ledger enable row level security;
alter table public.audit_logs enable row level security;

-- Do not expose tables to anonymous callers. Authenticated callers receive only read access;
-- writes happen later through security-definer RPCs with embedded authorization checks.
revoke all on schema public from anon;
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on table public.profiles,
  public.permissions,
  public.role_permissions,
  public.user_permission_overrides,
  public.captain_status,
  public.orders,
  public.order_status_history,
  public.financial_ledger,
  public.audit_logs to authenticated;

create policy "profiles_select_self_or_authorized_staff"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_permission('manage_users')
  or (role = 'captain'::public.app_role and public.has_permission('assign_captains'))
);

create policy "permissions_select_authenticated"
on public.permissions
for select
to authenticated
using (true);

create policy "role_permissions_select_authorized_staff"
on public.role_permissions
for select
to authenticated
using (public.has_permission('manage_permissions'));

create policy "user_permission_overrides_select_self_or_authorized_staff"
on public.user_permission_overrides
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_permission('manage_permissions')
);

create policy "captain_status_select_self_or_assignment_staff"
on public.captain_status
for select
to authenticated
using (
  captain_id = (select auth.uid())
  or public.has_permission('assign_captains')
  or public.has_permission('manage_users')
);

create policy "orders_select_assigned_captain_or_authorized_staff"
on public.orders
for select
to authenticated
using (public.can_view_order(id));

create policy "order_history_select_if_order_is_visible"
on public.order_status_history
for select
to authenticated
using (public.can_view_order(order_id));

create policy "financial_ledger_select_own_or_finance_staff"
on public.financial_ledger
for select
to authenticated
using (
  (captain_id = (select auth.uid()) and public.has_permission('view_own_earnings'))
  or public.has_permission('view_finances')
);

create policy "audit_logs_select_authorized_staff"
on public.audit_logs
for select
to authenticated
using (public.has_permission('view_audit_logs'));

-- Trigger and SECURITY DEFINER helper functions must not be freely callable through the Data API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.has_permission(text) from public, anon;
revoke all on function public.can_view_order(uuid) from public, anon;
revoke all on function public.set_captain_availability(public.captain_availability) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.can_view_order(uuid) to authenticated;
grant execute on function public.set_captain_availability(public.captain_availability) to authenticated;
