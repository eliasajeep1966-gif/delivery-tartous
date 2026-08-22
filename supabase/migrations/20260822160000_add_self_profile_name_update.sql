-- Delivery Tartous: allow an authenticated user to update only their own display name.
-- Email and password remain owned by Supabase Auth; role and account state stay protected.

create or replace function public.update_my_profile(p_full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_full_name text := nullif(trim(p_full_name), '');
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if v_full_name is null then
    raise exception 'A full name is required' using errcode = '22023';
  end if;

  if char_length(v_full_name) > 120 then
    raise exception 'Full name is too long' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = v_full_name
  where id = v_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Profile was not found' using errcode = 'P0002';
  end if;

  return v_profile;
end;
$$;

alter function public.update_my_profile(text) owner to postgres;
revoke all on function public.update_my_profile(text) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;
