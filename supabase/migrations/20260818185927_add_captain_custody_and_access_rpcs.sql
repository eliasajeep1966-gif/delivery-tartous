-- Delivery Tartous: captain custody records and admin-only access management RPCs.

insert into public.permissions (code, description) values
  ('manage_captain_custody', 'Assign and return captain custody items')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, is_allowed)
values ('admin'::public.app_role, 'manage_captain_custody', true)
on conflict (role, permission_code) do update set is_allowed = excluded.is_allowed;

create table public.captain_custody (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.profiles(id) on delete restrict,
  item_name text not null,
  item_details text,
  assigned_by_user_id uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  returned_by_user_id uuid references public.profiles(id) on delete restrict,
  returned_at timestamptz,
  return_notes text,
  created_at timestamptz not null default now(),
  constraint captain_custody_item_name_not_blank check (length(trim(item_name)) > 0),
  constraint captain_custody_return_consistency check (
    (returned_at is null and returned_by_user_id is null and return_notes is null)
    or (returned_at is not null and returned_by_user_id is not null)
  )
);

create index captain_custody_active_by_captain_idx
  on public.captain_custody (captain_id, assigned_at desc)
  where returned_at is null;

create index captain_custody_active_items_idx
  on public.captain_custody (assigned_at desc)
  where returned_at is null;

alter table public.captain_custody enable row level security;
revoke all on table public.captain_custody from anon, authenticated;
grant select on public.captain_custody to authenticated;

create policy "captain_custody_select_own_or_authorized_admin"
on public.captain_custody
for select
to authenticated
using (
  captain_id = (select auth.uid())
  or private.has_permission('manage_captain_custody')
);

create or replace function private.assert_admin_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_role() is distinct from 'admin'::public.app_role then
    raise exception 'Only an active admin can manage users and access' using errcode = '42501';
  end if;
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
  v_profile public.profiles;
begin
  perform private.assert_admin_access();

  update public.profiles
  set role = p_role
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if p_role = 'captain'::public.app_role then
    insert into public.captain_status (captain_id, availability)
    values (p_user_id, 'unavailable'::public.captain_availability)
    on conflict (captain_id) do nothing;
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'user_role_changed',
    'profile',
    p_user_id,
    jsonb_build_object('role', p_role::text)
  );

  return v_profile;
end;
$$;

create or replace function private.set_user_permission_override(
  p_user_id uuid,
  p_permission_code text,
  p_is_allowed boolean
)
returns public.user_permission_overrides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_override public.user_permission_overrides;
begin
  perform private.assert_admin_access();

  if not exists (select 1 from public.permissions where code = p_permission_code) then
    raise exception 'Unknown permission code' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  insert into public.user_permission_overrides (user_id, permission_code, is_allowed)
  values (p_user_id, p_permission_code, p_is_allowed)
  on conflict (user_id, permission_code) do update
    set is_allowed = excluded.is_allowed,
        updated_at = now()
  returning * into v_override;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'user_permission_override_set',
    'profile',
    p_user_id,
    jsonb_build_object('permission_code', p_permission_code, 'is_allowed', p_is_allowed)
  );

  return v_override;
end;
$$;

create or replace function private.assign_captain_custody(
  p_captain_id uuid,
  p_item_name text,
  p_item_details text default null
)
returns public.captain_custody
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_custody public.captain_custody;
begin
  if not private.has_permission('manage_captain_custody') then
    raise exception 'Current user is not allowed to assign captain custody' using errcode = '42501';
  end if;

  if coalesce(length(trim(p_item_name)), 0) = 0 then
    raise exception 'Custody item name is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_captain_id
      and role = 'captain'::public.app_role
  ) then
    raise exception 'Custody can only be assigned to a captain' using errcode = '22023';
  end if;

  insert into public.captain_custody (
    captain_id,
    item_name,
    item_details,
    assigned_by_user_id
  )
  values (
    p_captain_id,
    trim(p_item_name),
    nullif(trim(coalesce(p_item_details, '')), ''),
    (select auth.uid())
  )
  returning * into v_custody;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'captain_custody_assigned',
    'captain_custody',
    v_custody.id,
    jsonb_build_object('captain_id', p_captain_id, 'item_name', v_custody.item_name)
  );

  return v_custody;
end;
$$;

create or replace function private.return_captain_custody(
  p_custody_id uuid,
  p_return_notes text default null
)
returns public.captain_custody
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_custody public.captain_custody;
begin
  if not private.has_permission('manage_captain_custody') then
    raise exception 'Current user is not allowed to return captain custody' using errcode = '42501';
  end if;

  update public.captain_custody
  set returned_at = now(),
      returned_by_user_id = (select auth.uid()),
      return_notes = nullif(trim(coalesce(p_return_notes, '')), '')
  where id = p_custody_id
    and returned_at is null
  returning * into v_custody;

  if not found then
    raise exception 'Active custody record not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'captain_custody_returned',
    'captain_custody',
    v_custody.id,
    jsonb_build_object('captain_id', v_custody.captain_id, 'item_name', v_custody.item_name)
  );

  return v_custody;
end;
$$;

create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns public.profiles
language sql
security invoker
set search_path = ''
as $$
  select private.set_user_role(p_user_id, p_role)
$$;

create or replace function public.set_user_permission_override(
  p_user_id uuid,
  p_permission_code text,
  p_is_allowed boolean
)
returns public.user_permission_overrides
language sql
security invoker
set search_path = ''
as $$
  select private.set_user_permission_override(p_user_id, p_permission_code, p_is_allowed)
$$;

create or replace function public.assign_captain_custody(
  p_captain_id uuid,
  p_item_name text,
  p_item_details text default null
)
returns public.captain_custody
language sql
security invoker
set search_path = ''
as $$
  select private.assign_captain_custody(p_captain_id, p_item_name, p_item_details)
$$;

create or replace function public.return_captain_custody(
  p_custody_id uuid,
  p_return_notes text default null
)
returns public.captain_custody
language sql
security invoker
set search_path = ''
as $$
  select private.return_captain_custody(p_custody_id, p_return_notes)
$$;

revoke all on function private.assert_admin_access() from public, anon;
revoke all on function private.set_user_role(uuid, public.app_role) from public, anon;
revoke all on function private.set_user_permission_override(uuid, text, boolean) from public, anon;
revoke all on function private.assign_captain_custody(uuid, text, text) from public, anon;
revoke all on function private.return_captain_custody(uuid, text) from public, anon;
grant execute on function private.assert_admin_access() to authenticated;
grant execute on function private.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function private.set_user_permission_override(uuid, text, boolean) to authenticated;
grant execute on function private.assign_captain_custody(uuid, text, text) to authenticated;
grant execute on function private.return_captain_custody(uuid, text) to authenticated;

revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
revoke all on function public.set_user_permission_override(uuid, text, boolean) from public, anon;
revoke all on function public.assign_captain_custody(uuid, text, text) from public, anon;
revoke all on function public.return_captain_custody(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.set_user_permission_override(uuid, text, boolean) to authenticated;
grant execute on function public.assign_captain_custody(uuid, text, text) to authenticated;
grant execute on function public.return_captain_custody(uuid, text) to authenticated;
