-- Delivery Tartous: execute the server-only activation wrapper as its owner.
-- Local-only migration. Do not apply without explicit owner approval.
-- The private finalization function remains unchanged and private schema usage is not granted.

create or replace function public.finalize_pending_account_activation(
  p_email text,
  p_auth_user_id uuid
)
returns public.profiles
language sql
security definer
set search_path = ''
as $$
  select private.finalize_pending_account_activation(p_email, p_auth_user_id)
$$;

alter function public.finalize_pending_account_activation(text, uuid) owner to postgres;

revoke all on function public.finalize_pending_account_activation(text, uuid)
  from public, anon, authenticated;

grant execute on function public.finalize_pending_account_activation(text, uuid)
  to service_role;
