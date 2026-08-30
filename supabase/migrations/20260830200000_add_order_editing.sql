-- Allow back-office users with the existing cancellation permission to edit an order
-- only before delivery starts. The order identity, assignment, and history remain intact.
create or replace function private.update_order_with_stops(
  p_order_id uuid,
  p_stops jsonb,
  p_fee numeric
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_pickup public.order_stops;
  v_delivery public.order_stops;
  v_stop jsonb;
  v_pickup_count integer := 0;
  v_delivery_count integer := 0;
  v_fee numeric;
begin
  if not private.has_permission('cancel_orders') then
    raise exception 'Current user is not allowed to edit orders' using errcode = '42501';
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
    raise exception 'Only orders before delivery starts can be edited' using errcode = '22023';
  end if;

  if p_fee is null then
    raise exception 'A positive order fee is required' using errcode = '22023';
  end if;
  v_fee := round(p_fee, 2);
  if v_fee = 'NaN'::numeric or v_fee <= 0 or v_fee > 9999999999.99::numeric then
    raise exception 'Order fee must be a positive finite value and fit the supported precision' using errcode = '22023';
  end if;

  if p_stops is null or jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) = 0 then
    raise exception 'p_stops must be a non-empty JSON array' using errcode = '22023';
  end if;

  for v_stop in select value from jsonb_array_elements(p_stops) loop
    if jsonb_typeof(v_stop) <> 'object'
       or v_stop ->> 'stop_type' not in ('pickup', 'delivery')
       or coalesce(v_stop ->> 'sequence', '') !~ '^[1-9][0-9]*$'
       or nullif(btrim(v_stop ->> 'contact_name'), '') is null
       or nullif(btrim(v_stop ->> 'contact_phone'), '') is null
       or nullif(btrim(v_stop ->> 'address'), '') is null
       or ((v_stop ? 'note') and jsonb_typeof(v_stop -> 'note') not in ('string', 'null')) then
      raise exception 'Every stop must have a valid type, sequence, contact, address, and optional note' using errcode = '22023';
    end if;
    if v_stop ->> 'stop_type' = 'pickup' then
      v_pickup_count := v_pickup_count + 1;
    else
      v_delivery_count := v_delivery_count + 1;
    end if;
  end loop;

  if v_pickup_count = 0 or v_delivery_count = 0 then
    raise exception 'At least one pickup and one delivery stop are required' using errcode = '22023';
  end if;

  delete from public.order_stops where order_id = p_order_id;

  insert into public.order_stops (
    order_id, stop_type, sequence, contact_name, contact_phone, address, note
  )
  select
    p_order_id,
    s.stop_type::public.order_stop_type,
    s.sequence,
    btrim(s.contact_name),
    btrim(s.contact_phone),
    btrim(s.address),
    nullif(btrim(s.note), '')
  from jsonb_to_recordset(p_stops) as s(
    stop_type text,
    sequence integer,
    contact_name text,
    contact_phone text,
    address text,
    note text
  );

  select * into v_pickup
  from public.order_stops
  where order_id = p_order_id and stop_type = 'pickup'::public.order_stop_type
  order by sequence asc limit 1;

  select * into v_delivery
  from public.order_stops
  where order_id = p_order_id and stop_type = 'delivery'::public.order_stop_type
  order by sequence asc limit 1;

  update public.orders
  set customer_name = v_delivery.contact_name,
      customer_phone = v_delivery.contact_phone,
      pickup_address = v_pickup.address,
      delivery_address = v_delivery.address,
      fee = v_fee
  where id = p_order_id
  returning * into v_order;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()),
    'order_edited',
    'order',
    p_order_id,
    jsonb_build_object('order_number', v_order.order_number, 'fee', v_order.fee)
  );

  return v_order;
end;
$$;

create or replace function public.update_order_with_stops(
  p_order_id uuid,
  p_stops jsonb,
  p_fee numeric
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.update_order_with_stops(p_order_id, p_stops, p_fee)
$$;

revoke all on function private.update_order_with_stops(uuid, jsonb, numeric) from public, anon;
grant execute on function private.update_order_with_stops(uuid, jsonb, numeric) to authenticated;
revoke all on function public.update_order_with_stops(uuid, jsonb, numeric) from public, anon;
grant execute on function public.update_order_with_stops(uuid, jsonb, numeric) to authenticated;
