-- Delivery Tartous: pending-account activation without invitation links or email delivery.
-- This migration intentionally adds the new flow without modifying historical migrations.

create table public.pending_account_activations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role public.app_role not null,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  constraint pending_account_activations_email_normalized check (
    email = lower(email)
    and email = btrim(email)
    and length(email) > 3
  ),
  constraint pending_account_activations_full_name_length check (
    full_name is null or length(btrim(full_name)) between 1 and 120
  ),
  constraint pending_account_activations_state_consistency check (
    (activated_at is null and auth_user_id is null)
    or (activated_at is not null and auth_user_id is not null)
  ),
  constraint pending_account_activations_not_cancelled_after_activation check (
    cancelled_at is null or (activated_at is null and auth_user_id is null)
  )
);

create index pending_account_activations_open_idx
  on public.pending_account_activations (created_at desc)
  where activated_at is null and cancelled_at is null;

create table public.pending_captain_custody (
  id uuid primary key default gen_random_uuid(),
  pending_account_id uuid not null references public.pending_account_activations(id) on delete cascade,
  item_name text not null,
  created_at timestamptz not null default now(),
  constraint pending_captain_custody_item_name_not_blank check (length(btrim(item_name)) > 0),
  constraint pending_captain_custody_item_name_max_length check (length(item_name) <= 160),
  unique (pending_account_id, item_name)
);

create index pending_captain_custody_pending_account_idx
  on public.pending_captain_custody (pending_account_id, created_at asc);

alter table public.pending_account_activations enable row level security;
alter table public.pending_captain_custody enable row level security;

revoke all on table public.pending_account_activations, public.pending_captain_custody
  from anon, authenticated;
grant select on table public.pending_account_activations, public.pending_captain_custody
  to authenticated;

create policy "pending_accounts_select_active_admin_only"
on public.pending_account_activations
for select
to authenticated
using (private.current_user_role() = 'admin'::public.app_role);

create policy "pending_captain_custody_select_active_admin_only"
on public.pending_captain_custody
for select
to authenticated
using (private.current_user_role() = 'admin'::public.app_role);

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
begin
  perform private.assert_admin_access();

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
    from unnest(regexp_split_to_array(coalesce(p_custody_items_text, ''), E'\\r?\\n')) as raw_item
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
begin
  perform private.assert_admin_access();

  update public.pending_account_activations
  set cancelled_at = now()
  where id = p_pending_id
    and activated_at is null
    and cancelled_at is null
  returning * into v_pending;

  if not found then
    raise exception 'Active pending account was not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'pending_account_cancelled',
    'pending_account_activation',
    v_pending.id,
    jsonb_build_object('email', v_pending.email, 'role', v_pending.role::text)
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
begin
  perform private.assert_admin_access();

  return query
  select *
  from public.pending_account_activations
  order by created_at desc;
end;
$$;

-- This function is server-only. The Edge Function calls it with service_role after Auth creates the user.
create or replace function private.finalize_pending_account_activation(
  p_email text,
  p_auth_user_id uuid
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_pending public.pending_account_activations;
  v_profile public.profiles;
  v_custody_count integer := 0;
begin
  if p_auth_user_id is null or v_email = '' then
    raise exception 'Invalid activation request' using errcode = '22023';
  end if;

  select *
  into v_pending
  from public.pending_account_activations
  where email = v_email
    and activated_at is null
    and cancelled_at is null
    and auth_user_id is null
  for update;

  if not found then
    raise exception 'Activation could not be completed' using errcode = 'P0002';
  end if;

  update public.profiles
  set role = v_pending.role,
      full_name = v_pending.full_name,
      is_active = true,
      account_activated_at = now()
  where id = p_auth_user_id
    and email = v_email
  returning * into v_profile;

  if not found then
    raise exception 'Activation could not be completed' using errcode = 'P0002';
  end if;

  if v_pending.role = 'captain'::public.app_role then
    insert into public.captain_status (captain_id, availability)
    values (p_auth_user_id, 'unavailable'::public.captain_availability)
    on conflict (captain_id) do nothing;

    insert into public.captain_custody (
      captain_id,
      item_name,
      assigned_by_user_id,
      assigned_at
    )
    select
      p_auth_user_id,
      pc.item_name,
      v_pending.created_by_user_id,
      pc.created_at
    from public.pending_captain_custody pc
    where pc.pending_account_id = v_pending.id;

    get diagnostics v_custody_count = row_count;
  end if;

  update public.pending_account_activations
  set activated_at = now(),
      auth_user_id = p_auth_user_id
  where id = v_pending.id;

  delete from public.pending_captain_custody
  where pending_account_id = v_pending.id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_auth_user_id,
    'pending_account_activated',
    'profile',
    p_auth_user_id,
    jsonb_build_object(
      'pending_account_id', v_pending.id,
      'role', v_pending.role::text,
      'custody_item_count', v_custody_count
    )
  );

  return v_profile;
end;
$$;

create or replace function public.create_pending_account(
  p_email text,
  p_full_name text default null,
  p_role public.app_role default 'captain'::public.app_role,
  p_custody_items_text text default null
)
returns public.pending_account_activations
language sql
security invoker
set search_path = ''
as $$
  select private.create_pending_account(p_email, p_full_name, p_role, p_custody_items_text)
$$;

create or replace function public.cancel_pending_account(
  p_pending_id uuid
)
returns public.pending_account_activations
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_pending_account(p_pending_id)
$$;

create or replace function public.list_pending_accounts()
returns setof public.pending_account_activations
language sql
security invoker
set search_path = ''
as $$
  select * from private.list_pending_accounts()
$$;

create or replace function public.finalize_pending_account_activation(
  p_email text,
  p_auth_user_id uuid
)
returns public.profiles
language sql
security invoker
set search_path = ''
as $$
  select private.finalize_pending_account_activation(p_email, p_auth_user_id)
$$;

revoke all on function private.create_pending_account(text, text, public.app_role, text) from public, anon;
revoke all on function private.cancel_pending_account(uuid) from public, anon;
revoke all on function private.list_pending_accounts() from public, anon;
revoke all on function private.finalize_pending_account_activation(text, uuid) from public, anon, authenticated;

grant execute on function private.create_pending_account(text, text, public.app_role, text) to authenticated;
grant execute on function private.cancel_pending_account(uuid) to authenticated;
grant execute on function private.list_pending_accounts() to authenticated;
grant execute on function private.finalize_pending_account_activation(text, uuid) to service_role;

revoke all on function public.create_pending_account(text, text, public.app_role, text) from public, anon;
revoke all on function public.cancel_pending_account(uuid) from public, anon;
revoke all on function public.list_pending_accounts() from public, anon;
revoke all on function public.finalize_pending_account_activation(text, uuid) from public, anon, authenticated;

grant execute on function public.create_pending_account(text, text, public.app_role, text) to authenticated;
grant execute on function public.cancel_pending_account(uuid) to authenticated;
grant execute on function public.list_pending_accounts() to authenticated;
grant execute on function public.finalize_pending_account_activation(text, uuid) to service_role;
