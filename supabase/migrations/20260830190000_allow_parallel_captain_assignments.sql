-- A captain remains assignable while explicitly available, even with active orders.
-- The existing two-argument and public wrappers call this overload.
create or replace function private.assign_order_captain(
  p_order_id uuid,
  p_captain_id uuid,
  p_record_activity boolean
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_captain_is_available boolean;
begin
  if not private.has_permission('assign_captains') then
    raise exception 'Current user is not allowed to assign captains' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.status <> 'pending'::public.order_status then
    raise exception 'Only a pending order can be assigned' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.profiles p
    join public.captain_status cs on cs.captain_id = p.id
    where p.id = p_captain_id
      and p.role = 'captain'::public.app_role
      and p.is_active = true
      and cs.availability = 'available'::public.captain_availability
  ) into v_captain_is_available;

  if not v_captain_is_available then
    raise exception 'Captain must be active and available before assignment' using errcode = '22023';
  end if;

  update public.orders
  set assigned_captain_id = p_captain_id,
      status = 'assigned'::public.order_status,
      assigned_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (
    order_id,
    previous_status,
    next_status,
    changed_by_user_id,
    note
  )
  values (
    v_order.id,
    'pending'::public.order_status,
    'assigned'::public.order_status,
    (select auth.uid()),
    'Captain assigned'
  );

  if coalesce(p_record_activity, true) then
    insert into public.audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      (select auth.uid()),
      'order_assigned',
      'order',
      v_order.id,
      jsonb_build_object('captain_id', p_captain_id)
    );
  end if;

  return v_order;
end;
$$;

-- Keep the original dashboard fields and add a parallel-safe active_orders payload.
create or replace function private.get_my_captain_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_captain_id uuid := auth.uid();
  v_today date := timezone('Asia/Damascus', now())::date;
  v_result jsonb;
begin
  if private.current_user_role() <> 'captain'::public.app_role then
    raise exception 'Current user is not allowed to view captain dashboard' using errcode = '42501';
  end if;

  if v_captain_id is null then
    raise exception 'Authenticated captain is required' using errcode = '42501';
  end if;

  with active_orders as (
    select o.*
    from public.orders o
    where o.assigned_captain_id = v_captain_id
      and o.status in ('assigned'::public.order_status, 'received'::public.order_status, 'in_delivery'::public.order_status)
    order by o.updated_at desc, o.created_at desc, o.id desc
  ), recent_orders as (
    select o.*
    from public.orders o
    where o.assigned_captain_id = v_captain_id
    order by o.created_at desc, o.id desc
    limit 4
  ), all_orders as (
    select count(*)::integer as order_count
    from public.orders o
    where o.assigned_captain_id = v_captain_id
  ), today_completed as (
    select
      count(*)::integer as completed_count,
      coalesce(sum(o.fee), 0)::numeric as completed_gross
    from public.orders o
    where o.assigned_captain_id = v_captain_id
      and o.status = 'completed'::public.order_status
      and (o.completed_at at time zone 'Asia/Damascus')::date = v_today
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'availability', coalesce((
        select cs.availability::text
        from public.captain_status cs
        where cs.captain_id = v_captain_id
      ), 'offline'),
      'completed_count', today_completed.completed_count,
      'completed_gross', today_completed.completed_gross
    ),
    'order_count', all_orders.order_count,
    'active_order', (
      select to_jsonb(ao)
      from active_orders ao
      order by ao.updated_at desc, ao.created_at desc, ao.id desc
      limit 1
    ),
    'active_stops', coalesce((
      select jsonb_agg(to_jsonb(os) order by os.stop_type asc, os.sequence asc)
      from public.order_stops os
      where os.order_id = (
        select ao.id from active_orders ao
        order by ao.updated_at desc, ao.created_at desc, ao.id desc limit 1
      )
    ), '[]'::jsonb),
    'active_orders', coalesce((
      select jsonb_agg(
        to_jsonb(ao) || jsonb_build_object(
          'stops', coalesce((
            select jsonb_agg(to_jsonb(os) order by os.stop_type asc, os.sequence asc)
            from public.order_stops os
            where os.order_id = ao.id
          ), '[]'::jsonb)
        )
        order by ao.updated_at desc, ao.created_at desc, ao.id desc
      )
      from active_orders ao
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(to_jsonb(ro) order by ro.created_at desc, ro.id desc)
      from recent_orders ro
    ), '[]'::jsonb)
  )
  into v_result
  from all_orders, today_completed;

  return v_result;
end;
$$;

create or replace function public.get_my_captain_dashboard()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_my_captain_dashboard()
$$;
