-- Owner identity and silent-visibility guards.
-- The only Owner is resolved once from auth.users at migration time and stored
-- as an internal UUID. Runtime RPCs never compare against the Owner email.

create table private.application_owner (
  singleton boolean primary key default true check (singleton),
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint application_owner_singleton check (singleton = true)
);

revoke all on table private.application_owner from public, anon, authenticated;

insert into private.application_owner (singleton, owner_user_id)
select true, u.id
from auth.users u
where lower(u.email) = 'tartousdelivery@gmail.com';


do $$
begin
  if not exists (select 1 from private.application_owner) then
    raise exception 'Owner Auth account tartousdelivery@gmail.com was not found' using errcode = 'P0001';
  end if;
  if (select count(*) from private.application_owner) <> 1 then
    raise exception 'Exactly one Owner identity is required' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.owner_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ao.owner_user_id
  from private.application_owner ao
  where ao.singleton = true
$$;

create or replace function private.is_owner(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and p_user_id = private.owner_user_id()
$$;

alter function private.owner_user_id() owner to postgres;
alter function private.is_owner(uuid) owner to postgres;
revoke all on function private.owner_user_id() from public, anon, authenticated;
revoke all on function private.is_owner(uuid) from public, anon;
grant execute on function private.is_owner(uuid) to authenticated;

create or replace function private.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when private.is_owner(p.id) then true
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

create or replace function private.assert_admin_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_owner((select auth.uid()))
     and private.current_user_role() is distinct from 'admin'::public.app_role then
    raise exception 'Only an active admin or Owner can manage users and access' using errcode = '42501';
  end if;
end;
$$;

-- Protect role and active-state changes to the Owner from every non-Owner actor.
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

  select *
  into v_target
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if private.is_owner(p_user_id) then
    if not private.is_owner((select auth.uid())) or p_role <> 'admin'::public.app_role then
      raise exception 'The Owner role is protected' using errcode = '42501';
    end if;
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

create or replace function private.set_user_active(
  p_user_id uuid,
  p_is_active boolean
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

  select * into v_target
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if private.is_owner(p_user_id) then
    raise exception 'The Owner account cannot be deactivated' using errcode = '42501';
  end if;

  if v_target.role = 'admin'::public.app_role
     and v_target.is_active
     and not p_is_active then
    perform pg_advisory_xact_lock(hashtextextended('delivery_tartous:last_active_admin_role_change', 0));
    select count(*) into v_active_admin_count
    from public.profiles
    where role = 'admin'::public.app_role and is_active;
    if v_active_admin_count <= 1 then
      raise exception 'Cannot deactivate the last active admin' using errcode = 'P0001';
    end if;
  end if;

  update public.profiles set is_active = p_is_active
  where id = p_user_id
  returning * into v_profile;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    case when p_is_active then 'user_reactivated' else 'user_deactivated' end,
    'profile', p_user_id,
    jsonb_build_object('is_active', p_is_active, 'actor_role', private.current_user_role()::text)
  );

  return v_profile;
end;
$$;

create or replace function public.set_user_active(
  p_user_id uuid,
  p_is_active boolean
)
returns public.profiles
language sql
set search_path = ''
as $$
  select private.set_user_active(p_user_id, p_is_active)
$$;

alter function private.set_user_active(uuid, boolean) owner to postgres;
alter function public.set_user_active(uuid, boolean) owner to postgres;
revoke all on function private.set_user_active(uuid, boolean) from public, anon;
grant execute on function private.set_user_active(uuid, boolean) to authenticated;
revoke all on function public.set_user_active(uuid, boolean) from public, anon;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;

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
  if private.is_owner(p_captain_id) then
    raise exception 'The Owner account cannot be deactivated' using errcode = '42501';
  end if;

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

create or replace function private.protect_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_owner(old.id) then
    if tg_op = 'DELETE' then
      raise exception 'The Owner account is protected' using errcode = '42501';
    elsif new.role is distinct from old.role
       or new.is_active is distinct from old.is_active then
      raise exception 'The Owner account is protected' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter function private.protect_owner_profile() owner to postgres;
revoke all on function private.protect_owner_profile() from public, anon, authenticated;

drop trigger if exists protect_owner_profile on public.profiles;
create trigger protect_owner_profile
before update or delete on public.profiles
for each row execute function private.protect_owner_profile();

-- Keep self-profile reads available for authentication, but expose staff lists
-- through this filtered API so the Owner never appears in application lists.
create or replace function private.list_visible_profiles(
  p_limit integer default 25,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  if not private.has_permission('manage_users')
     and not private.has_permission('manage_captains') then
    raise exception 'Current user is not allowed to list users' using errcode = '42501';
  end if;

  return query
  select p.*
  from public.profiles p
  where not private.is_owner(p.id)
    and (
      private.has_permission('manage_users')
      or p.role = 'captain'::public.app_role
    )
    and (
      p_before_created_at is null
      or p.created_at < p_before_created_at
      or (p.created_at = p_before_created_at and p_before_id is not null and p.id < p_before_id)
    )
  order by p.created_at desc, p.id desc
  limit v_limit;
end;
$$;

create or replace function public.list_visible_profiles(
  p_limit integer default 25,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns setof public.profiles
language sql
set search_path = ''
as $$
  select * from private.list_visible_profiles(p_limit, p_before_created_at, p_before_id)
$$;

alter function private.list_visible_profiles(integer, timestamptz, uuid) owner to postgres;
alter function public.list_visible_profiles(integer, timestamptz, uuid) owner to postgres;
revoke all on function private.list_visible_profiles(integer, timestamptz, uuid) from public, anon;
grant execute on function private.list_visible_profiles(integer, timestamptz, uuid) to authenticated;
revoke all on function public.list_visible_profiles(integer, timestamptz, uuid) from public, anon;
grant execute on function public.list_visible_profiles(integer, timestamptz, uuid) to authenticated;

-- Direct profile reads used by the existing client remain allowed for self-profile,
-- while every staff listing path excludes the Owner row.
drop policy if exists profiles_select_self_or_authorized_staff on public.profiles;
create policy profiles_select_self_or_authorized_staff
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (
    not private.is_owner(id)
    and (
      private.has_permission('manage_users')
      or (
        role = 'captain'::public.app_role
        and private.has_permission('assign_captains'::text)
      )
    )
  )
);

-- Orders created by the Owner remain in the internal table but are absent from
-- operational application reads, including the Owner's own client session.
create or replace function private.can_view_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
      select 1
      from public.orders o
      where o.id = target_order_id
        and private.is_owner(o.created_by_user_id)
    )
    and (
      private.has_permission('view_all_orders')
      or (
        private.has_permission('view_own_orders')
        and exists (
          select 1
          from public.orders o
          where o.id = target_order_id
            and o.assigned_captain_id = (select auth.uid())
        )
      )
    )
$$;

-- Hide Owner-associated audit rows from application reads, never delete them.
drop policy if exists audit_logs_select_authorized_staff on public.audit_logs;
create policy audit_logs_select_authorized_staff
on public.audit_logs
for select
to authenticated
using (
  private.has_permission('view_audit_logs')
  and not private.is_owner(actor_user_id)
  and not private.is_owner(entity_id)
);

-- Keep Owner-created orders and Owner-attributed activities out of Home's
-- presentation payload while retaining all audit rows internally.
create or replace function private.get_backoffice_home_summary()
returns table(
  assigned_count bigint,
  in_delivery_count bigint,
  completed_today_count bigint,
  cancelled_today_count bigint,
  recent_order_activities jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_damascus_day date := (now() at time zone 'Asia/Damascus')::date;
  v_day_start timestamptz;
  v_next_day_start timestamptz;
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view backoffice home data' using errcode = '42501';
  end if;

  v_day_start := v_damascus_day::timestamp at time zone 'Asia/Damascus';
  v_next_day_start := (v_damascus_day + 1)::timestamp at time zone 'Asia/Damascus';

  return query
  with order_counts as (
    select
      count(*) filter (
        where not private.is_owner(o.created_by_user_id)
          and o.status = 'assigned'::public.order_status
      )::bigint as assigned_count,
      count(*) filter (
        where not private.is_owner(o.created_by_user_id)
          and o.status in ('received'::public.order_status, 'in_delivery'::public.order_status)
      )::bigint as in_delivery_count,
      count(*) filter (
        where not private.is_owner(o.created_by_user_id)
          and o.status = 'completed'::public.order_status
          and o.completed_at >= v_day_start
          and o.completed_at < v_next_day_start
      )::bigint as completed_today_count,
      count(*) filter (
        where not private.is_owner(o.created_by_user_id)
          and o.status = 'cancelled'::public.order_status
          and o.cancelled_at >= v_day_start
          and o.cancelled_at < v_next_day_start
      )::bigint as cancelled_today_count
    from public.orders o
  ), recent_activity_rows as (
    select
      al.id,
      al.entity_id,
      al.action,
      al.metadata,
      al.actor_user_id,
      al.created_at
    from public.audit_logs al
    where al.entity_type = 'order'
      and not private.is_owner(al.actor_user_id)
      and exists (
        select 1
        from public.orders o
        where o.id = al.entity_id
          and not private.is_owner(o.created_by_user_id)
      )
      and (
        al.action in ('order_created_with_stops', 'order_assigned')
        or (
          al.action = 'order_status_changed'
          and al.metadata ->> 'to_status' in ('received','in_delivery','completed','false_order','cancelled')
        )
      )
    order by al.created_at desc
    limit 6
  ), recent_activities as (
    select
      rar.id,
      rar.entity_id as order_id,
      o.order_number,
      case
        when rar.action = 'order_created_with_stops' then 'إنشاء طلب'
        when rar.action = 'order_assigned' then 'إسناد طلب'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'received' then 'استلام الطلب'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'in_delivery' then 'بدء التوصيل'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'completed' then 'تم التوصيل'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'false_order' then 'طلب كاذب'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'cancelled' then 'إلغاء الطلب'
      end as action,
      case when rar.action = 'order_status_changed' then rar.metadata ->> 'to_status' else null end as to_status,
      rar.actor_user_id,
      actor_profile.full_name as actor_name,
      case
        when rar.action = 'order_assigned' then jsonb_strip_nulls(jsonb_build_object('captain_id', rar.metadata -> 'captain_id'))
        else '{}'::jsonb
      end as metadata,
      rar.created_at
    from recent_activity_rows rar
    left join public.orders o on o.id = rar.entity_id
    left join public.profiles actor_profile on actor_profile.id = rar.actor_user_id
  ), activity_payload as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ra.id,
          'order_id', ra.order_id,
          'order_number', ra.order_number,
          'action', ra.action,
          'to_status', ra.to_status,
          'actor_user_id', ra.actor_user_id,
          'actor_name', ra.actor_name,
          'metadata', ra.metadata,
          'created_at', ra.created_at
        ) order by ra.created_at desc
      ),
      '[]'::jsonb
    ) as recent_order_activities
    from recent_activities ra
  )
  select oc.assigned_count, oc.in_delivery_count, oc.completed_today_count,
         oc.cancelled_today_count, ap.recent_order_activities
  from order_counts oc cross join activity_payload ap;
end;
$$;

-- Pending records created by the Owner are also absent from application lists.
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
  select * from public.pending_account_activations
  where not private.is_owner(created_by_user_id)
    and (v_is_admin or role = 'captain'::public.app_role)
    and activated_at is null and cancelled_at is null
  order by created_at desc;
end;
$$;

create or replace function private.list_pending_accounts(
  p_limit integer default 25,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns setof public.pending_account_activations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_is_admin boolean := private.has_permission('manage_users');
  v_can_manage_captains boolean := private.has_permission('manage_captains');
begin
  if not v_is_admin and not v_can_manage_captains then
    raise exception 'Current user is not allowed to list pending accounts' using errcode = '42501';
  end if;
  return query
  select * from public.pending_account_activations
  where not private.is_owner(created_by_user_id)
    and (v_is_admin or role = 'captain'::public.app_role)
    and activated_at is null and cancelled_at is null
    and (
      p_before_created_at is null
      or created_at < p_before_created_at
      or (created_at = p_before_created_at and p_before_id is not null and id < p_before_id)
    )
  order by created_at desc, id desc
  limit v_limit;
end;
$$;

alter function private.has_permission(text) owner to postgres;
alter function private.assert_admin_access() owner to postgres;
alter function private.set_user_role(uuid, public.app_role) owner to postgres;
alter function private.set_captain_active(uuid, boolean) owner to postgres;
alter function private.can_view_order(uuid) owner to postgres;
alter function private.get_backoffice_home_summary() owner to postgres;
alter function private.list_pending_accounts() owner to postgres;
alter function private.list_pending_accounts(integer, timestamptz, uuid) owner to postgres;

-- Public wrappers remain invoker-facing; only existing wrapper grants are kept.
