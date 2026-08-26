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
  v_captain_is_busy boolean;
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

  select exists (
    select 1
    from public.orders active_order
    where active_order.assigned_captain_id = p_captain_id
      and active_order.id <> p_order_id
      and active_order.status in (
        'assigned'::public.order_status,
        'received'::public.order_status,
        'in_delivery'::public.order_status
      )
  ) into v_captain_is_busy;

  if v_captain_is_busy then
    raise exception 'Captain is busy with an active order until delivery is completed' using errcode = '22023';
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
