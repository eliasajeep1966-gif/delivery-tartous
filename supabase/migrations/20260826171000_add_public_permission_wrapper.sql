-- Existing RPCs use this public wrapper while the underlying RBAC helper
-- remains private. The wrapper exposes only a boolean permission decision.
create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission(required_permission)
$$;

alter function public.has_permission(text) owner to postgres;
revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;
