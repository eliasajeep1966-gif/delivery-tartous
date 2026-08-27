create table if not exists public.office_settings (
  id boolean primary key default true check (id),
  office_name text not null default 'دليفري طرطوس',
  office_phone text not null default '0933000000',
  office_address text not null default 'طرطوس — مركز المدينة',
  captain_share numeric(5, 2) not null default 70 check (captain_share >= 0 and captain_share <= 100),
  office_share numeric(5, 2) not null default 30 check (office_share >= 0 and office_share <= 100),
  distribution_exceptions jsonb not null default '[]'::jsonb check (jsonb_typeof(distribution_exceptions) = 'array'),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references public.profiles(id),
  check (captain_share + office_share = 100)
);

alter table public.office_settings enable row level security;

insert into public.office_settings (id)
values (true)
on conflict (id) do nothing;

create or replace function private.can_manage_office_settings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('manage_users')
    or private.has_permission('view_finances')
$$;

create or replace function private.get_office_settings()
returns public.office_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.office_settings;
begin
  if not private.can_manage_office_settings() then
    raise exception 'Current user is not allowed to view office settings' using errcode = '42501';
  end if;

  select * into v_settings
  from public.office_settings
  where id = true;

  return v_settings;
end;
$$;

create or replace function public.get_office_settings()
returns public.office_settings
language sql
set search_path = ''
as $$
  select * from private.get_office_settings()
$$;

create or replace function private.update_office_settings(
  p_office_name text,
  p_office_phone text,
  p_office_address text,
  p_captain_share numeric,
  p_office_share numeric,
  p_distribution_exceptions jsonb
)
returns public.office_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.office_settings;
begin
  if not private.can_manage_office_settings() then
    raise exception 'Current user is not allowed to update office settings' using errcode = '42501';
  end if;

  if coalesce(length(trim(p_office_name)), 0) = 0
    or coalesce(length(trim(p_office_phone)), 0) = 0
    or coalesce(length(trim(p_office_address)), 0) = 0 then
    raise exception 'Office name, phone, and address are required' using errcode = '22023';
  end if;

  if p_captain_share is null
    or p_office_share is null
    or p_captain_share < 0
    or p_office_share < 0
    or p_captain_share + p_office_share <> 100 then
    raise exception 'Office distribution shares must total 100' using errcode = '22023';
  end if;

  if p_distribution_exceptions is null
    or jsonb_typeof(p_distribution_exceptions) <> 'array' then
    raise exception 'Distribution exceptions must be an array' using errcode = '22023';
  end if;

  update public.office_settings
  set office_name = trim(p_office_name),
      office_phone = trim(p_office_phone),
      office_address = trim(p_office_address),
      captain_share = p_captain_share,
      office_share = p_office_share,
      distribution_exceptions = p_distribution_exceptions,
      updated_at = now(),
      updated_by_user_id = (select auth.uid())
  where id = true
  returning * into v_settings;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    (select auth.uid()),
    'office_settings_updated',
    'office_settings',
    null,
    jsonb_build_object(
      'captain_share', p_captain_share,
      'office_share', p_office_share,
      'exception_count', jsonb_array_length(p_distribution_exceptions)
    )
  );

  return v_settings;
end;
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

alter function private.can_manage_office_settings() owner to postgres;
alter function private.get_office_settings() owner to postgres;
alter function public.get_office_settings() owner to postgres;
alter function private.update_office_settings(text, text, text, numeric, numeric, jsonb) owner to postgres;
alter function public.update_office_settings(text, text, text, numeric, numeric, jsonb) owner to postgres;

revoke all on table public.office_settings from public, anon, authenticated;
revoke all on function private.can_manage_office_settings() from public, anon, authenticated;
revoke all on function private.get_office_settings() from public, anon, authenticated;
revoke all on function private.update_office_settings(text, text, text, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.get_office_settings() from public, anon;
revoke all on function public.update_office_settings(text, text, text, numeric, numeric, jsonb) from public, anon;
grant execute on function public.get_office_settings() to authenticated;
grant execute on function public.update_office_settings(text, text, text, numeric, numeric, jsonb) to authenticated;
