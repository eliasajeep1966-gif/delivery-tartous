-- Delivery Tartous: synchronize Supabase Auth users with application profiles.
-- Roles are never read from user metadata: every newly created account starts as captain.

create or replace function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    raise exception 'An email address is required for every application account';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    is_active
  )
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'captain'::public.app_role,
    true
  );

  return new;
end;
$$;

create or replace function private.handle_auth_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = lower(new.email)
    where id = new.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_auth_user_created();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute procedure private.handle_auth_user_email_updated();

revoke all on function private.handle_auth_user_created() from public, anon, authenticated;
revoke all on function private.handle_auth_user_email_updated() from public, anon, authenticated;
