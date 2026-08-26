-- Delivery Tartous: compact server-side dashboard payload for the signed-in captain.
-- Returns only the active order, its stops, four recent orders, and Damascus-day metrics.

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

  with active_order as (
    select o.*
    from public.orders o
    where o.assigned_captain_id = v_captain_id
      and o.status in ('assigned'::public.order_status, 'received'::public.order_status, 'in_delivery'::public.order_status)
    order by o.updated_at desc, o.created_at desc, o.id desc
    limit 1
  ), active_stops as (
    select os.*
    from public.order_stops os
    join active_order ao on ao.id = os.order_id
    order by os.stop_type asc, os.sequence asc
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
      'availability', coalesce(
        (
          select cs.availability::text
          from public.captain_status cs
          where cs.captain_id = v_captain_id
        ),
        'offline'
      ),
      'completed_count', today_completed.completed_count,
      'completed_gross', today_completed.completed_gross
    ),
    'order_count', all_orders.order_count,
    'active_order', (select to_jsonb(ao) from active_order ao),
    'active_stops', coalesce(
      (
        select jsonb_agg(to_jsonb(stops) order by stops.stop_type asc, stops.sequence asc)
        from active_stops stops
      ),
      '[]'::jsonb
    ),
    'recent_orders', coalesce(
      (
        select jsonb_agg(to_jsonb(recent) order by recent.created_at desc, recent.id desc)
        from recent_orders recent
      ),
      '[]'::jsonb
    )
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

revoke all on function private.get_my_captain_dashboard() from public, anon;
grant execute on function private.get_my_captain_dashboard() to authenticated;
revoke all on function public.get_my_captain_dashboard() from public, anon;
grant execute on function public.get_my_captain_dashboard() to authenticated;
