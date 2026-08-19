-- Delivery Tartous: allow supervisors to manage captains only.
-- This migration intentionally does not broaden supervisor access to admins, supervisors,
-- user permission overrides, finance, or captain custody records.

insert into public.permissions (code, description)
values ('manage_captains', 'Create, cancel pending, deactivate, or reactivate captain accounts only')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, is_allowed)
values
  ('admin'::public.app_role, 'manage_captains', true),
  ('supervisor'::public.app_role, 'manage_captains', true)
on conflict (role, permission_code) do update
  set is_allowed = excluded.is_allowed,
      updated_at = now();

-- Supervisors can see only captain pending accounts. Admins retain visibility of all pending accounts.
drop policy if exists "pending_accounts_select_active_admin_only" on public.pending_account_activations;
create policy "pending_accounts_select_authorized_role_scope"
on public.pending_account_activations
for select
to authenticated
using (
  private.has_permission('manage_users')
  or (
    role = 'captain'::public.app_role
    and private.has_permission('manage_captains')
  )
);

create or replace function private.create_pending_account(
  p_email text,
  p_full_name text,
  p_role public.app_role,
  p_custody_items_text text default null
)
returns public.pending_account_activations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_items text[];
  v_pending public.pending_account_activations;
  v_item text;
  v_is_admin boolean := private.has_permission('manage_users');
  v_can_manage_captains boolean := private.has_permission('manage_captains');
begin
  if not v_is_admin and not v_can_manage_captains then
    raise exception 'Current user is not allowed to create pending accounts' using errcode = '42501';
  end if;

  -- A supervisor can only create a captain. An admin can keep creating any supported role.
  if not v_is_admin and p_role <> 'captain'::public.app_role then
    raise exception 'Supervisors can only create captain accounts' using errcode = '42501';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 320 then
    raise exception 'A valid normalized email is required' using errcode = '22023';
  end if;

  if v_full_name is not null and length(v_full_name) > 120 then
    raise exception 'Full name must be 120 characters or fewer' using errcode = '22023';
  end if;

  select coalesce(array_agg(item_name), '{}'::text[])
  into v_items
  from (
    select nullif(btrim(raw_item), '') as item_name
    from unnest(regexp_split_to_array(coalesce(p_custody_items_text, ''), E'\r?\n')) as raw_item
  ) parsed
  where item_name is not null;

  if coalesce(cardinality(v_items), 0) > 20 then
    raise exception 'Maximum 20 custody items are allowed' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_items) as item where length(item) > 160) then
    raise exception 'Each custody item must be 160 characters or fewer' using errcode = '22023';
  end if;

  if p_role <> 'captain'::public.app_role and coalesce(cardinality(v_items), 0) > 0 then
    raise exception 'Custody items can only be assigned to a captain' using errcode = '22023';
  end if;

  -- Captain custody remains admin-only. A supervisor can create a captain but cannot assign items.
  if not v_is_admin and coalesce(cardinality(v_items), 0) > 0 then
    raise exception 'Only an admin can assign captain custody items' using errcode = '42501';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An Auth user already exists for this email' using errcode = '23505';
  end if;

  if exists (select 1 from public.pending_account_activations where email = v_email) then
    raise exception 'A pending account record already exists for this email' using errcode = '23505';
  end if;

  insert into public.pending_account_activations (
    email,
    full_name,
    role,
    created_by_user_id
  )
  values (
    v_email,
    v_full_name,
    p_role,
    (select auth.uid())
  )
  returning * into v_pending;

  foreach v_item in array v_items loop
    insert into public.pending_captain_custody (pending_account_id, item_name)
    values (v_pending.id, v_item);
  end loop;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'pending_account_created',
    'pending_account_activation',
    v_pending.id,
    jsonb_build_object(
      'email', v_pending.email,
      'role', v_pending.role::text,
      'created_by_role', private.current_user_role()::text,
      'custody_item_count', coalesce(cardinality(v_items), 0)
    )
  );

  return v_pending;
end;
$$;

create or replace function private.cancel_pending_account(
  p_pending_id uuid
)
returns public.pending_account_activations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pending public.pending_account_activations;
  v_is_admin boolean := private.has_permission('manage_users');
  v_can_manage_captains boolean := private.has_permission('manage_captains');
begin
  if not v_is_admin and not v_can_manage_captains then
    raise exception 'Current user is not allowed to cancel pending accounts' using errcode = '42501';
  end if;

  update public.pending_account_activations
  set cancelled_at = now()
  where id = p_pending_id
    and activated_at is null
    and cancelled_at is null
    and (
      v_is_admin
      or (role = 'captain'::public.app_role and v_can_manage_captains)
    )
  returning * into v_pending;

  if not found then
    raise exception 'Active pending account was not found in the caller scope' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'pending_account_cancelled',
    'pending_account_activation',
    v_pending.id,
    jsonb_build_object(
      'email', v_pending.email,
      'role', v_pending.role::text,
      'cancelled_by_role', private.current_user_role()::text
    )
  );

  return v_pending;
end;
$$;

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
  where v_is_admin or role = 'captain'::public.app_role
  order by created_at desc;
end;
$$;

create or replace function private.set_captain_active(
  p_captain_id uuid,
  p_is_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not private.has_permission('manage_captains') then
    raise exception 'Current user is not allowed to manage captains' using errcode = '42501';
  end if;

  if p_is_active = false and exists (
    select 1
    from public.orders
    where assigned_captain_id = p_captain_id
      and status in (
        'assigned'::public.order_status,
        'received'::public.order_status,
        'in_delivery'::public.order_status
      )
  ) then
    raise exception 'A captain with active delivery orders cannot be deactivated' using errcode = '22023';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_captain_id
    and role = 'captain'::public.app_role
  returning * into v_profile;

  if not found then
    raise exception 'Captain profile was not found' using errcode = 'P0002';
  end if;

  if p_is_active = false then
    insert into public.captain_status (captain_id, availability)
    values (p_captain_id, 'unavailable'::public.captain_availability)
    on conflict (captain_id) do update
      set availability = 'unavailable'::public.captain_availability,
          updated_at = now();
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    case when p_is_active then 'captain_reactivated' else 'captain_deactivated' end,
    'profile',
    p_captain_id,
    jsonb_build_object('is_active', p_is_active, 'actor_role', private.current_user_role()::text)
  );

  return v_profile;
end;
$$;

create or replace function public.set_captain_active(
  p_captain_id uuid,
  p_is_active boolean
)
returns public.profiles
language sql
security invoker
set search_path = ''
as $$
  select private.set_captain_active(p_captain_id, p_is_active)
$$;

revoke all on function private.set_captain_active(uuid, boolean) from public, anon;
grant execute on function private.set_captain_active(uuid, boolean) to authenticated;

revoke all on function public.set_captain_active(uuid, boolean) from public, anon;
grant execute on function public.set_captain_active(uuid, boolean) to authenticated;
