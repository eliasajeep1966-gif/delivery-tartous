-- Delivery Tartous: make multi-stop order creation safely retryable from mobile and web clients.
-- The advisory transaction lock serializes requests carrying the same key so a network retry
-- returns the original order instead of creating a duplicate.

alter table public.orders
  add column if not exists idempotency_key text,
  add column if not exists order_kind text not null default 'standard';

create unique index if not exists orders_created_by_idempotency_key_unique
  on public.orders (created_by_user_id, idempotency_key)
  where idempotency_key is not null;

-- Add a three-argument overload without renaming or replacing the deployed two-argument
-- implementation. Existing database dependencies and older clients therefore remain intact.
create or replace function private.create_order_with_stops(
  p_stops jsonb,
  p_fee numeric,
  p_idempotency_key text
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

  if v_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended((select auth.uid())::text || ':' || v_key, 0)
    );

    select *
    into v_order
    from public.orders
    where created_by_user_id = (select auth.uid())
      and idempotency_key = v_key
    limit 1;

    if found then
      return v_order;
    end if;
  end if;

  v_order := private.create_order_with_stops(p_stops, p_fee);

  update public.orders
  set idempotency_key = v_key,
      order_kind = 'multi_stop'
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.create_order_with_stops(
  p_stops jsonb,
  p_fee numeric,
  p_idempotency_key text
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_order_with_stops(p_stops, p_fee, p_idempotency_key)
$$;

-- The existing public.create_order_with_stops(jsonb, numeric) overload is deliberately
-- left unchanged for compatibility. Omitting the idempotency key still uses that API.
revoke all on function private.create_order_with_stops(jsonb, numeric, text) from public, anon;
grant execute on function private.create_order_with_stops(jsonb, numeric, text) to authenticated;
revoke all on function public.create_order_with_stops(jsonb, numeric, text) from public, anon;
grant execute on function public.create_order_with_stops(jsonb, numeric, text) to authenticated;

comment on function private.create_order_with_stops(jsonb, numeric, text) is
  'Idempotent overload around the original validated two-argument multi-stop order creation function.';
