-- Keep one Home activity card for a cancelled order: its original creation card is
-- presented as the cancellation instead of showing a second cancellation card.
-- Audit logs and order status history remain complete for traceability.
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
  ), latest_order_cancellations as (
    select distinct on (al.entity_id)
      al.entity_id,
      al.actor_user_id,
      al.metadata,
      al.created_at
    from public.audit_logs al
    where al.entity_type = 'order'
      and (
        al.action = 'order_cancelled'
        or (
          al.action = 'order_status_changed'
          and al.metadata ->> 'to_status' = 'cancelled'
        )
      )
    order by al.entity_id, al.created_at desc
  ), recent_activity_rows as (
    select
      al.id,
      al.entity_id,
      case
        when al.action in ('order_created', 'order_created_with_stops')
          and cancellation.entity_id is not null
          then 'order_cancelled'
        else al.action
      end as action,
      case
        when al.action in ('order_created', 'order_created_with_stops')
          and cancellation.entity_id is not null
          then cancellation.metadata
        else al.metadata
      end as metadata,
      case
        when al.action in ('order_created', 'order_created_with_stops')
          and cancellation.entity_id is not null
          then cancellation.actor_user_id
        else al.actor_user_id
      end as actor_user_id,
      case
        when al.action in ('order_created', 'order_created_with_stops')
          and cancellation.entity_id is not null
          then cancellation.created_at
        else al.created_at
      end as created_at
    from public.audit_logs al
    left join latest_order_cancellations cancellation on cancellation.entity_id = al.entity_id
    where al.entity_type = 'order'
      and not private.is_owner(al.actor_user_id)
      and exists (
        select 1
        from public.orders o
        where o.id = al.entity_id
          and not private.is_owner(o.created_by_user_id)
      )
      and (
        al.action in ('order_created', 'order_created_with_stops', 'order_assigned')
        or (
          al.action = 'order_status_changed'
          and al.metadata ->> 'to_status' in ('received', 'in_delivery', 'completed', 'false_order')
        )
      )
    order by
      case
        when al.action in ('order_created', 'order_created_with_stops')
          and cancellation.entity_id is not null
          then cancellation.created_at
        else al.created_at
      end desc
    limit 6
  ), recent_activities as (
    select
      rar.id,
      rar.entity_id as order_id,
      o.order_number,
      case
        when rar.action in ('order_created', 'order_created_with_stops') then 'إنشاء طلب'
        when rar.action = 'order_cancelled' then 'إلغاء الطلب'
        when rar.action = 'order_assigned' then 'إسناد طلب'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'received' then 'استلام الطلب'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'in_delivery' then 'بدء التوصيل'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'completed' then 'تم التوصيل'
        when rar.action = 'order_status_changed' and rar.metadata ->> 'to_status' = 'false_order' then 'طلب كاذب'
      end as action,
      case
        when rar.action = 'order_cancelled' then 'cancelled'
        when rar.action = 'order_status_changed' then rar.metadata ->> 'to_status'
        else null
      end as to_status,
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

alter function private.get_backoffice_home_summary() owner to postgres;
revoke all on function private.get_backoffice_home_summary() from public, anon;
grant execute on function private.get_backoffice_home_summary() to authenticated;
