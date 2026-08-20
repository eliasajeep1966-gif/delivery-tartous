begin;

create or replace function private.set_user_permission_override(
  p_user_id uuid,
  p_permission_code text,
  p_is_allowed boolean
)
returns public.user_permission_overrides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_override public.user_permission_overrides;
  v_target_role public.app_role;
begin
  perform private.assert_admin_access();

  if not exists (select 1 from public.permissions where code = p_permission_code) then
    raise exception 'Unknown permission code' using errcode = '22023';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found' using errcode = 'P0002';
  end if;

  if v_target_role <> 'supervisor'::public.app_role then
    raise exception 'Permission overrides can only be set for supervisors' using errcode = '22023';
  end if;

  insert into public.user_permission_overrides (user_id, permission_code, is_allowed)
  values (p_user_id, p_permission_code, p_is_allowed)
  on conflict (user_id, permission_code) do update
    set is_allowed = excluded.is_allowed,
        updated_at = now()
  returning * into v_override;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'user_permission_override_set',
    'profile',
    p_user_id,
    jsonb_build_object('permission_code', p_permission_code, 'is_allowed', p_is_allowed)
  );

  return v_override;
end;
$$;

commit;
