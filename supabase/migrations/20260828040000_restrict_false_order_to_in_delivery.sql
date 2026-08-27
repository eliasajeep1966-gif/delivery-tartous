-- A captain receives the company-funded false-order compensation only after
-- the delivery route has started. This trigger also protects direct or future
-- status-update paths that might bypass the current RPC implementation.
create or replace function private.prevent_false_order_before_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'false_order'::public.order_status
     and old.status <> 'in_delivery'::public.order_status then
    raise exception 'Only an in-delivery order can be marked false'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_false_order_before_delivery on public.orders;

create trigger prevent_false_order_before_delivery
before update of status on public.orders
for each row
when (new.status = 'false_order'::public.order_status)
execute function private.prevent_false_order_before_delivery();
