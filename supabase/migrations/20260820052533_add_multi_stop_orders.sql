-- Delivery Tartous: multi-stop orders with one order-level fee.
-- Applied to the live Supabase project on 2026-08-20; preserve this migration for reproducible deployments.
-- Financial settlement remains one financial_ledger row per public.orders row.

create type public.order_stop_type as enum ('pickup', 'delivery');

create table public.order_stops (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stop_type public.order_stop_type not null,
  sequence integer not null check (sequence > 0),
  contact_name text not null,
  contact_phone text not null,
  address text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint order_stops_contact_name_not_blank check (length(btrim(contact_name)) > 0),
  constraint order_stops_contact_phone_not_blank check (length(btrim(contact_phone)) > 0),
  constraint order_stops_address_not_blank check (length(btrim(address)) > 0),
  constraint order_stops_order_type_sequence_key unique (order_id, stop_type, sequence)
);

comment on table public.order_stops is
  'Ordered pickup and delivery contact points for an order. orders.fee remains the only fee source.';

-- The UNIQUE constraint above creates the required B-tree index on
-- (order_id, stop_type, sequence). Do not create a duplicate index.
alter table public.order_stops enable row level security;

revoke all on table public.order_stops from anon, authenticated;
grant select on table public.order_stops to authenticated;

create policy "order_stops_select_if_parent_order_is_visible"
on public.order_stops
for select
to authenticated
using (private.can_view_order(order_id));

create or replace function private.create_order_with_stops(
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
  v_stop jsonb;
  v_normalized_stops jsonb := '[]'::jsonb;
  v_fee numeric;
  v_stop_type_text text;
  v_stop_sequence_text text;
  v_stop_sequence integer;
  v_contact_name text;
  v_contact_phone text;
  v_address text;
  v_note text;
  v_seen_type_sequences text[] := '{}'::text[];
  v_type_sequence_key text;
  v_pickup_count integer := 0;
  v_delivery_count integer := 0;
  v_first_pickup_address text;
  v_first_delivery_contact_name text;
  v_first_delivery_contact_phone text;
  v_first_delivery_address text;
begin
  if not private.has_permission('create_orders') then
    raise exception 'Current user is not allowed to create orders' using errcode = '42501';
  end if;

  if p_fee is null then
    raise exception 'A positive order fee is required' using errcode = '22023';
  end if;

  v_fee := round(p_fee, 2);

  if v_fee = 'NaN'::numeric
     or v_fee <= 0
     or v_fee > 9999999999.99::numeric then
    raise exception 'Order fee must be a positive finite value and fit the supported precision' using errcode = '22023';
  end if;

  if p_stops is null
     or jsonb_typeof(p_stops) <> 'array'
     or jsonb_array_length(p_stops) = 0 then
    raise exception 'p_stops must be a non-empty JSON array' using errcode = '22023';
  end if;

  for v_stop in
    select value
    from jsonb_array_elements(p_stops)
  loop
    if jsonb_typeof(v_stop) <> 'object' then
      raise exception 'Every stop must be a JSON object' using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_object_keys(v_stop) as key_name
      where key_name not in (
        'stop_type',
        'sequence',
        'contact_name',
        'contact_phone',
        'address',
        'note'
      )
    ) then
      raise exception 'Stops contain an unsupported field' using errcode = '22023';
    end if;

    if not (v_stop ? 'stop_type')
       or not (v_stop ? 'sequence')
       or not (v_stop ? 'contact_name')
       or not (v_stop ? 'contact_phone')
       or not (v_stop ? 'address') then
      raise exception 'Every stop requires stop_type, sequence, contact_name, contact_phone, and address' using errcode = '22023';
    end if;

    if jsonb_typeof(v_stop -> 'stop_type') <> 'string'
       or jsonb_typeof(v_stop -> 'sequence') <> 'number'
       or jsonb_typeof(v_stop -> 'contact_name') <> 'string'
       or jsonb_typeof(v_stop -> 'contact_phone') <> 'string'
       or jsonb_typeof(v_stop -> 'address') <> 'string'
       or ((v_stop ? 'note') and jsonb_typeof(v_stop -> 'note') not in ('string', 'null')) then
      raise exception 'Stop fields have invalid JSON types' using errcode = '22023';
    end if;

    v_stop_type_text := v_stop ->> 'stop_type';
    v_stop_sequence_text := v_stop ->> 'sequence';

    if v_stop_type_text not in ('pickup', 'delivery') then
      raise exception 'stop_type must be pickup or delivery' using errcode = '22023';
    end if;

    -- Sequence must normalize to a positive integer within PostgreSQL integer precision.
    if v_stop_sequence_text !~ '^[1-9][0-9]*$'
       or length(v_stop_sequence_text) > 10
       or v_stop_sequence_text::numeric > 2147483647::numeric then
      raise exception 'sequence must be a positive integer' using errcode = '22023';
    end if;

    v_stop_sequence := v_stop_sequence_text::integer;
    v_contact_name := btrim(v_stop ->> 'contact_name');
    v_contact_phone := btrim(v_stop ->> 'contact_phone');
    v_address := btrim(v_stop ->> 'address');
    v_note := case
      when v_stop ? 'note' and jsonb_typeof(v_stop -> 'note') = 'string'
        then nullif(btrim(v_stop ->> 'note'), '')
      else null
    end;

    if v_contact_name = '' or v_contact_phone = '' or v_address = '' then
      raise exception 'Stop contact name, phone, and address must not be blank' using errcode = '22023';
    end if;

    v_type_sequence_key := v_stop_type_text || ':' || v_stop_sequence::text;

    if v_type_sequence_key = any(v_seen_type_sequences) then
      raise exception 'sequence must be unique within each stop_type' using errcode = '22023';
    end if;

    v_seen_type_sequences := array_append(v_seen_type_sequences, v_type_sequence_key);

    if v_stop_type_text = 'pickup' then
      v_pickup_count := v_pickup_count + 1;
    else
      v_delivery_count := v_delivery_count + 1;
    end if;

    v_normalized_stops := v_normalized_stops || jsonb_build_array(
      jsonb_build_object(
        'stop_type', v_stop_type_text,
        'sequence', v_stop_sequence,
        'contact_name', v_contact_name,
        'contact_phone', v_contact_phone,
        'address', v_address,
        'note', v_note
      )
    );
  end loop;

  if v_pickup_count = 0 or v_delivery_count = 0 then
    raise exception 'At least one pickup and one delivery stop are required' using errcode = '22023';
  end if;

  select s.address
  into v_first_pickup_address
  from jsonb_to_recordset(v_normalized_stops) as s(
    stop_type text,
    sequence integer,
    contact_name text,
    contact_phone text,
    address text,
    note text
  )
  where s.stop_type = 'pickup'
  order by s.sequence asc
  limit 1;

  select s.contact_name, s.contact_phone, s.address
  into v_first_delivery_contact_name, v_first_delivery_contact_phone, v_first_delivery_address
  from jsonb_to_recordset(v_normalized_stops) as s(
    stop_type text,
    sequence integer,
    contact_name text,
    contact_phone text,
    address text,
    note text
  )
  where s.stop_type = 'delivery'
  order by s.sequence asc
  limit 1;

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
    v_first_delivery_contact_name,
    v_first_delivery_contact_phone,
    v_first_pickup_address,
    v_first_delivery_address,
    v_fee,
    'pending'::public.order_status,
    (select auth.uid())
  )
  returning * into v_order;

  insert into public.order_stops (
    order_id,
    stop_type,
    sequence,
    contact_name,
    contact_phone,
    address,
    note
  )
  select
    v_order.id,
    s.stop_type::public.order_stop_type,
    s.sequence,
    s.contact_name,
    s.contact_phone,
    s.address,
    s.note
  from jsonb_to_recordset(v_normalized_stops) as s(
    stop_type text,
    sequence integer,
    contact_name text,
    contact_phone text,
    address text,
    note text
  )
  order by s.stop_type, s.sequence;

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
    'Order created with multiple stops'
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
    'order_created_with_stops',
    'order',
    v_order.id,
    jsonb_build_object(
      'order_number', v_order.order_number,
      'fee', v_order.fee,
      'pickup_count', v_pickup_count,
      'delivery_count', v_delivery_count
    )
  );

  return v_order;
end;
$$;

create or replace function public.create_order_with_stops(
  p_stops jsonb,
  p_fee numeric
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_order_with_stops(p_stops, p_fee)
$$;

revoke all on function private.create_order_with_stops(jsonb, numeric) from public, anon;
grant execute on function private.create_order_with_stops(jsonb, numeric) to authenticated;

revoke all on function public.create_order_with_stops(jsonb, numeric) from public, anon;
grant execute on function public.create_order_with_stops(jsonb, numeric) to authenticated;
