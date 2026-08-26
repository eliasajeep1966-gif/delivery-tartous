-- Allow the service-role client used by send-order-push to read only the
-- rows needed for requester validation, order lookup, and captain tokens.
grant select on table public.profiles, public.orders, public.push_tokens to service_role;
