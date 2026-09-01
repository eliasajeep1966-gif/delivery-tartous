-- Keep order_kind within the live check constraint.
-- The exception-aware wrapper must not assign the invalid value 'multi_stop'.
-- No objects are dropped, no columns are altered, and no data is deleted.

-- Fix the live schema drift where orders.idempotency_key is uuid while the
-- idempotent multi-stop RPC receives a text key from the mobile client.
-- This migration does not drop objects, alter tables, or delete data.

create or replace function private.create_order_with_stops(
  p_stops jsonb,
  p_fee numeric,
  p_idempotency_key text,
  p_exception_keyword text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(btrim(p_idempotency_key), '');
  v_order public.orders;
begin
  if v_key is not null and length(v_key) > 200 then
    raise exception 'Idempotency key is too long' using errcode = '22023';
  end if;

  if v_key is not null and v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Idempotency key must be a UUID' using errcode = '22023';
  end if;

  if v_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended((select auth.uid())::text || ':' || v_key, 0)
    );

    select *
    into v_order
    from public.orders
    where created_by_user_id = (select auth.uid())
      and idempotency_key::text = v_key
    limit 1;

    if found then
      return v_order;
    end if;
  end if;

  v_order := private.create_order_with_stops(p_stops, p_fee);

  update public.orders
  set idempotency_key = case when v_key is null then null else v_key::uuid end,
      distribution_exception_keyword = nullif(btrim(p_exception_keyword), '')
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function private.create_order_with_stops(jsonb, numeric, text, text) from public, anon;
grant execute on function private.create_order_with_stops(jsonb, numeric, text, text) to authenticated;

create or replace function public.create_order_with_stops(
  p_stops jsonb,
  p_fee numeric,
  p_idempotency_key text,
  p_exception_keyword text default null
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_order_with_stops(p_stops, p_fee, p_idempotency_key, p_exception_keyword)
$$;

revoke all on function public.create_order_with_stops(jsonb, numeric, text, text) from public, anon;
grant execute on function public.create_order_with_stops(jsonb, numeric, text, text) to authenticated;
