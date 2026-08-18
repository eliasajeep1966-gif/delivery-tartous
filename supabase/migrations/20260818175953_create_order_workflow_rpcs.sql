-- Delivery Tartous: protected order workflow RPCs.
-- Public wrappers are SECURITY INVOKER; private functions hold the privileged transaction logic.

create or replace function private.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_address text,
  p_delivery_address text,
  p_fee numeric
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not private.has_permission('create_orders') then
    raise exception 'Current user is not allowed to create orders' using errcode = '42501';
  end if;

  if coalesce(length(trim(p_customer_name)), 0) = 0
    or coalesce(length(trim(p_customer_phone)), 0) = 0
    or coalesce(length(trim(p_pickup_address)), 0) = 0
    or coalesce(length(trim(p_delivery_address)), 0) = 0
    or p_fee is null
    or p_fee <= 0 then
    raise exception 'Order customer, address, and positive fee fields are required' using errcode = '22023';
  end if;

  insert into public.orders (
    customer_name,
    customer_phone,
    pickup_address,
    delivery_address,
    fee,
    status,
    created_by_user_id
  )
  values (
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_pickup_address),
    trim(p_delivery_address),
    round(p_fee, 2),
    'pending'::public.order_status,
    (select auth.uid())
  )
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
    null,
    'pending'::public.order_status,
    (select auth.uid()),
    'Order created'
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
    'order_created',
    'order',
    v_order.id,
    jsonb_build_object('order_number', v_order.order_number, 'fee', v_order.fee)
  );

  return v_order;
end;
$$;

create or replace function private.assign_order_captain(
  p_order_id uuid,
  p_captain_id uuid
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

  return v_order;
end;
$$;

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
    'received'::public.order_status,
    'in_delivery'::public.order_status
  ) then
    raise exception 'Finalized order cannot be cancelled' using errcode = '22023';
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

create or replace function private.transition_assigned_order(
  p_order_id uuid,
  p_next_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_previous_status public.order_status;
  v_required_permission text;
  v_captain_amount numeric(12, 2);
begin
  if private.current_user_role() is distinct from 'captain'::public.app_role then
    raise exception 'Only an active captain can perform this order transition' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.assigned_captain_id is distinct from (select auth.uid()) then
    raise exception 'Only the assigned captain can change this order' using errcode = '42501';
  end if;

  case p_next_status
    when 'received'::public.order_status then
      v_required_permission := 'receive_assigned_order';
      if v_order.status <> 'assigned'::public.order_status then
        raise exception 'Only an assigned order can be marked received' using errcode = '22023';
      end if;
    when 'in_delivery'::public.order_status then
      v_required_permission := 'start_assigned_delivery';
      if v_order.status <> 'received'::public.order_status then
        raise exception 'Only a received order can be started' using errcode = '22023';
      end if;
    when 'completed'::public.order_status then
      v_required_permission := 'complete_assigned_order';
      if v_order.status <> 'in_delivery'::public.order_status then
        raise exception 'Only an in-delivery order can be completed' using errcode = '22023';
      end if;
    when 'false_order'::public.order_status then
      v_required_permission := 'mark_assigned_order_false';
      if v_order.status not in (
        'assigned'::public.order_status,
        'received'::public.order_status,
        'in_delivery'::public.order_status
      ) then
        raise exception 'This order cannot be marked false from its current status' using errcode = '22023';
      end if;
    else
      raise exception 'Captains cannot perform the requested target status' using errcode = '22023';
  end case;

  if not private.has_permission(v_required_permission) then
    raise exception 'Current captain does not have the required permission' using errcode = '42501';
  end if;

  v_previous_status := v_order.status;

  update public.orders
  set status = p_next_status,
      received_at = case when p_next_status = 'received'::public.order_status then now() else received_at end,
      completed_at = case when p_next_status = 'completed'::public.order_status then now() else completed_at end,
      false_order_at = case when p_next_status = 'false_order'::public.order_status then now() else false_order_at end
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
    p_next_status,
    (select auth.uid()),
    'Captain transition'
  );

  if p_next_status in ('completed'::public.order_status, 'false_order'::public.order_status) then
    v_captain_amount := round(v_order.fee * 0.70, 2);

    insert into public.financial_ledger (
      order_id,
      captain_id,
      source_status,
      gross_fee,
      captain_amount,
      company_amount,
      settlement_amount
    )
    values (
      v_order.id,
      v_order.assigned_captain_id,
      p_next_status,
      v_order.fee,
      v_captain_amount,
      case when p_next_status = 'completed'::public.order_status then v_order.fee - v_captain_amount else 0 end,
      case when p_next_status = 'false_order'::public.order_status then v_order.fee - v_captain_amount else 0 end
    );
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    'order_status_changed',
    'order',
    v_order.id,
    jsonb_build_object('from_status', v_previous_status::text, 'to_status', p_next_status::text)
  );

  return v_order;
end;
$$;

-- The public wrappers expose only controlled entry points. They hold no privileged access themselves.
create or replace function public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_address text,
  p_delivery_address text,
  p_fee numeric
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_order(
    p_customer_name,
    p_customer_phone,
    p_pickup_address,
    p_delivery_address,
    p_fee
  )
$$;

create or replace function public.assign_order_captain(
  p_order_id uuid,
  p_captain_id uuid
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.assign_order_captain(p_order_id, p_captain_id)
$$;

create or replace function public.cancel_order(
  p_order_id uuid,
  p_cancellation_reason text
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_order(p_order_id, p_cancellation_reason)
$$;

create or replace function public.transition_assigned_order(
  p_order_id uuid,
  p_next_status public.order_status
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.transition_assigned_order(p_order_id, p_next_status)
$$;

revoke all on function private.create_order(text, text, text, text, numeric) from public, anon;
revoke all on function private.assign_order_captain(uuid, uuid) from public, anon;
revoke all on function private.cancel_order(uuid, text) from public, anon;
revoke all on function private.transition_assigned_order(uuid, public.order_status) from public, anon;
grant execute on function private.create_order(text, text, text, text, numeric) to authenticated;
grant execute on function private.assign_order_captain(uuid, uuid) to authenticated;
grant execute on function private.cancel_order(uuid, text) to authenticated;
grant execute on function private.transition_assigned_order(uuid, public.order_status) to authenticated;

revoke all on function public.create_order(text, text, text, text, numeric) from public, anon;
revoke all on function public.assign_order_captain(uuid, uuid) from public, anon;
revoke all on function public.cancel_order(uuid, text) from public, anon;
revoke all on function public.transition_assigned_order(uuid, public.order_status) from public, anon;
grant execute on function public.create_order(text, text, text, text, numeric) to authenticated;
grant execute on function public.assign_order_captain(uuid, uuid) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.transition_assigned_order(uuid, public.order_status) to authenticated;
