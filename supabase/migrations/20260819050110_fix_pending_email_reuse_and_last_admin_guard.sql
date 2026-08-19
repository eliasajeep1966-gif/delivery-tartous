-- Fix Pending email reuse and prevent loss of the final active admin.
-- This migration intentionally replaces only the affected private functions and constraints.

-- A historical activated/cancelled Pending record must not block a later Pending account
-- for the same normalized email. Only one open Pending record is allowed.
alter table public.pending_account_activations
  drop constraint if exists pending_account_activations_email_key;

drop index if exists public.pending_account_activations_email_key;

create unique index pending_account_activations_open_email_key
  on public.pending_account_activations (email)
  where activated_at is null and cancelled_at is null;

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
  v_can_manage_custody boolean := private.has_permission('manage_captain_custody');
begin
  if not v_is_admin and not v_can_manage_captains then
    raise exception 'Current user is not allowed to create pending accounts' using errcode = '42501';
  end if;

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

  if coalesce(cardinality(v_items), 0) > 0 and not v_can_manage_custody then
    raise exception 'Current user is not allowed to assign captain custody' using errcode = '42501';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An Auth user already exists for this email' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.pending_account_activations
    where email = v_email
      and activated_at is null
      and cancelled_at is null
  ) then
    raise exception 'An open pending account already exists for this email' using errcode = '23505';
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

create or replace function private.set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
  v_profile public.profiles;
  v_active_admin_count integer;
begin
  perform private.assert_admin_access();

  -- Row lock provides a stable target; advisory lock serializes all final-admin
  -- checks in this function across concurrent transactions.
  select *
  into v_target
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if v_target.role = 'admin'::public.app_role
     and v_target.is_active
     and p_role <> 'admin'::public.app_role then
    perform pg_advisory_xact_lock(hashtextextended('delivery_tartous:last_active_admin_role_change', 0));

    select count(*)
    into v_active_admin_count
    from public.profiles
    where role = 'admin'::public.app_role
      and is_active;

    if v_active_admin_count <= 1 then
      raise exception 'Cannot remove the last active admin' using errcode = 'P0001';
    end if;
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id
  returning * into v_profile;

  if p_role = 'captain'::public.app_role then
    insert into public.captain_status (captain_id, availability)
    values (p_user_id, 'unavailable'::public.captain_availability)
    on conflict (captain_id) do nothing;
  end if;

  -- Audit occurs only after the protected role update succeeds.
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'user_role_changed',
    'profile',
    p_user_id,
    jsonb_build_object(
      'previous_role', v_target.role::text,
      'role', p_role::text
    )
  );

  return v_profile;
end;
$$;
