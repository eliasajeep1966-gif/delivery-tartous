create or replace function private.list_visible_profiles(
  p_limit integer default 25,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  if not private.has_permission('manage_users')
     and not private.has_permission('manage_captains')
     and not private.has_permission('assign_captains') then
    raise exception 'Current user is not allowed to list users' using errcode = '42501';
  end if;

  return query
  select p.*
  from public.profiles p
  where not private.is_owner(p.id)
    and (
      private.has_permission('manage_users')
      or private.has_permission('manage_captains')
      or (p.role = 'captain'::public.app_role and private.has_permission('assign_captains'))
    )
    and (
      p_before_created_at is null
      or p.created_at < p_before_created_at
      or (p.created_at = p_before_created_at and p_before_id is not null and p.id < p_before_id)
    )
  order by p.created_at desc, p.id desc
  limit v_limit;
end;
$$;

alter function private.list_visible_profiles(integer, timestamptz, uuid) owner to postgres;
revoke all on function private.list_visible_profiles(integer, timestamptz, uuid) from public, anon;
grant execute on function private.list_visible_profiles(integer, timestamptz, uuid) to authenticated;
