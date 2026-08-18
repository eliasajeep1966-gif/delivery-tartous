-- Delivery Tartous: account activation state for invitation-first password setup.

alter table public.profiles
  add column account_activated_at timestamptz;

-- The only existing user was created manually as the bootstrap admin before this flow existed.
update public.profiles
set account_activated_at = now()
where account_activated_at is null;

create or replace function private.complete_account_activation()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  update public.profiles
  set account_activated_at = coalesce(account_activated_at, now())
  where id = (select auth.uid())
    and is_active = true
  returning * into v_profile;

  if not found then
    raise exception 'Active user profile not found' using errcode = 'P0002';
  end if;

  return v_profile;
end;
$$;

create or replace function public.complete_account_activation()
returns public.profiles
language sql
security invoker
set search_path = ''
as $$
  select private.complete_account_activation()
$$;

revoke all on function private.complete_account_activation() from public, anon;
grant execute on function private.complete_account_activation() to authenticated;

revoke all on function public.complete_account_activation() from public, anon;
grant execute on function public.complete_account_activation() to authenticated;
