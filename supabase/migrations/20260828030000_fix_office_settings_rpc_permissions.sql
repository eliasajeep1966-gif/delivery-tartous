-- The public RPC wrappers are the only client entry point. They must run with
-- definer privileges to invoke the private authorization and data functions,
-- while the private functions still enforce the caller's authenticated role.
create or replace function public.get_office_settings()
returns public.office_settings
language sql
security definer
set search_path = ''
as $$
  select * from private.get_office_settings()
$$;

create or replace function public.update_office_settings(
  p_office_name text,
  p_office_phone text,
  p_office_address text,
  p_captain_share numeric,
  p_office_share numeric,
  p_distribution_exceptions jsonb
)
returns public.office_settings
language sql
security definer
set search_path = ''
as $$
  select * from private.update_office_settings(
    p_office_name,
    p_office_phone,
    p_office_address,
    p_captain_share,
    p_office_share,
    p_distribution_exceptions
  )
$$;

alter function public.get_office_settings() owner to postgres;
alter function public.update_office_settings(text, text, text, numeric, numeric, jsonb) owner to postgres;

revoke all on function public.get_office_settings() from public, anon;
revoke all on function public.update_office_settings(text, text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.get_office_settings() to authenticated;
grant execute on function public.update_office_settings(text, text, text, numeric, numeric, jsonb) to authenticated;
