create or replace function public.can_send_order_cancellation_push()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('cancel_orders')
$$;

alter function public.can_send_order_cancellation_push() owner to postgres;
revoke all on function public.can_send_order_cancellation_push() from public, anon;
grant execute on function public.can_send_order_cancellation_push() to authenticated;
