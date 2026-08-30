-- Allow active admins/owners to mutate the treasury through the same permission
-- resolution used by the rest of the finance APIs.
insert into public.permissions (code, description)
values ('manage_treasury', 'Record company treasury deposits and withdrawals')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, is_allowed)
values ('admin'::public.app_role, 'manage_treasury', true)
on conflict (role, permission_code) do update
set is_allowed = excluded.is_allowed,
    updated_at = now();

create or replace function private.require_treasury_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('manage_treasury') then
    raise exception 'Only an admin can change the treasury' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_treasury_admin() from public, anon;
