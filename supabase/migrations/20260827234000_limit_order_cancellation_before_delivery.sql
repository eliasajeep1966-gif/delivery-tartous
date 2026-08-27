-- An order can be cancelled only before the captain begins delivery.
-- Financial ledger rows are created only for completed/false orders, so a cancelled
-- pre-delivery order has zero captain and company earnings by design.
create or replace function private.cancel_order(
  p_order_id uuid,
  p_cancellation_reason text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_previous_status public.order_status;
begin
  if not private.has_permission('cancel_orders') then
    raise exception 'Current user is not allowed to cancel orders' using errcode = '42501';
  end if;

  if coalesce(length(trim(p_cancellation_reason)), 0) = 0 then
    raise exception 'Cancellation reason is required' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.status not in (
    'pending'::public.order_status,
    'assigned'::public.order_status,
    'received'::public.order_status
  ) then
    raise exception 'Order can only be cancelled before delivery starts' using errcode = '22023';
  end if;

  v_previous_status := v_order.status;

  update public.orders
  set status = 'cancelled'::public.order_status,
      cancellation_reason = trim(p_cancellation_reason),
      cancelled_at = now()
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
    v_previous_status,
    'cancelled'::public.order_status,
    (select auth.uid()),
    trim(p_cancellation_reason)
  );

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    'order_cancelled',
    'order',
    v_order.id,
    jsonb_build_object('reason', trim(p_cancellation_reason))
  );

  return v_order;
end;
$$;
