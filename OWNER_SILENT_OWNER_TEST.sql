-- Owner silent-identity verification.
-- Run only after applying the companion migration in an isolated review window.
-- Every mutation is rolled back. The test resolves Owner by the internal
-- internal owner_user_id UUID, never by email at runtime.

begin;
set local role postgres;
create temporary table owner_identity(owner_user_id uuid primary key);
insert into owner_identity select private.owner_user_id();
grant select on owner_identity to authenticated;

-- The Owner identity must be internal, singleton, and mapped to an Auth user.
select
  (select owner_user_id from owner_identity) is not null as owner_identity_resolved,
  private.is_owner((select owner_user_id from owner_identity)) as owner_identity_matches,
  (select count(*) from private.application_owner) = 1 as exactly_one_owner_record;

-- Owner receives every permission without relying on a React-side role list.
set local role authenticated;
select set_config('request.jwt.claim.sub', (select owner_user_id from owner_identity)::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select coalesce(bool_and(private.has_permission(p.code)), false) as owner_has_all_permissions
from public.permissions p;

-- Owner is not visible through the filtered application API.
select
  count(*) filter (where id = (select owner_user_id from owner_identity)) = 0 as owner_hidden_from_visible_profile_api,
  count(*) > 0 as visible_non_owner_profiles_exist
from public.list_visible_profiles(100, null, null);

-- Existing direct profile reads still support the Owner's own auth bootstrap.
select count(*) = 1 as owner_can_read_own_profile
from public.profiles
where id = (select owner_user_id from owner_identity);

-- Executable profilesPage path used by the web contract: Owner is absent.
select count(*) filter (where id = (select owner_user_id from owner_identity)) = 0
  as owner_hidden_from_profiles_page
from public.list_visible_profiles(26, null, null);

-- Executable ordersPage path used by the web contract: create one Owner order,
-- then confirm RLS/private.can_view_order hides it from the Owner's own list.
create temporary table owner_page_order(order_id uuid primary key);
insert into owner_page_order
select o.id
from public.create_order_with_stops(
  '[{"stop_type":"pickup","sequence":1,"contact_name":"Owner test","contact_phone":"000","address":"A","note":"ملاحظة اختبار"},{"stop_type":"delivery","sequence":1,"contact_name":"عميل","contact_phone":"111","address":"B","note":null}]'::jsonb,
  777,
  '77777777-7777-4777-8777-777777777777'::uuid
) o;
select count(*) = 0 as owner_hidden_from_orders_page
from public.orders
where id = (select order_id from owner_page_order);

-- Prepare a non-Owner Admin test actor from the existing Supervisor row.
set local role postgres;
create temporary table owner_test_actor(user_id uuid primary key);
insert into owner_test_actor
select id from public.profiles where role = 'supervisor'::public.app_role limit 1;
grant select on owner_test_actor to authenticated;
update public.profiles
set role = 'admin'::public.app_role
where id = (select user_id from owner_test_actor);

-- Owner can manage an Admin through the existing role RPC.
set local role authenticated;
select set_config('request.jwt.claim.sub', (select owner_user_id from owner_identity)::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.set_user_role((select user_id from owner_test_actor), 'supervisor'::public.app_role);
select
  (select role from public.profiles where id = (select user_id from owner_test_actor)) = 'supervisor'::public.app_role
  as owner_can_manage_admin;

-- Owner can deactivate and reactivate a non-Owner Admin.
select public.set_user_active((select user_id from owner_test_actor), false);
select
  (select is_active from public.profiles where id = (select user_id from owner_test_actor)) = false
  as owner_can_deactivate_admin;
select public.set_user_active((select user_id from owner_test_actor), true);
select
  (select is_active from public.profiles where id = (select user_id from owner_test_actor)) = true
  as owner_can_reactivate_admin;

-- Restore the test actor to Admin inside the same transaction for list/audit checks.
select public.set_user_role((select user_id from owner_test_actor), 'admin'::public.app_role);

-- A non-Owner Admin cannot alter the Owner role.
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id from owner_test_actor)::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
begin
  begin
    perform public.set_user_role((select owner_user_id from owner_identity), 'supervisor'::public.app_role);
    raise exception 'Expected non-Owner Admin role-change rejection';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

-- A non-Owner Admin cannot deactivate the Owner through the generic path.
do $$
begin
  begin
    perform public.set_user_active((select owner_user_id from owner_identity), false);
    raise exception 'Expected Owner deactivation rejection';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

-- The captain-specific path is also closed for the Owner identity.
do $$
begin
  begin
    perform public.set_captain_active((select owner_user_id from owner_identity), false);
    raise exception 'Expected Owner captain-path rejection';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

-- The same non-Owner Admin cannot delete the Owner through a direct table path.
do $$
begin
  begin
    delete from public.profiles where id = (select owner_user_id from owner_identity);
    raise exception 'Expected direct Owner delete rejection';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

-- Captain cannot alter the Owner role.
select set_config('request.jwt.claim.sub', '57f28491-deb8-45b7-a4ce-b3d885cb0601', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
begin
  begin
    perform public.set_user_role((select owner_user_id from owner_identity), 'captain'::public.app_role);
    raise exception 'Expected Captain role-change rejection';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

-- Supervisor must retain manage_captains and see only non-Owner captain rows.
set local role postgres;
update public.profiles
set role = 'supervisor'::public.app_role
where id = (select user_id from owner_test_actor);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id from owner_test_actor)::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select
  private.has_permission('manage_captains') as supervisor_manage_captains_preserved,
  count(*) filter (where id = (select owner_user_id from owner_identity)) = 0 as supervisor_profiles_hide_owner,
  bool_and(role = 'captain'::public.app_role) as supervisor_profiles_are_captains
from public.list_visible_profiles(100, null, null);

-- Supervisor ordersPage remains functional for ordinary non-Owner orders and
-- still excludes the Owner-created order.
create temporary table supervisor_page_order(order_id uuid primary key);
insert into supervisor_page_order
select o.id
from public.create_order_with_stops(
  '[{"stop_type":"pickup","sequence":1,"contact_name":"Supervisor test","contact_phone":"000","address":"C","note":"ملاحظة اختبار"},{"stop_type":"delivery","sequence":1,"contact_name":"عميل","contact_phone":"111","address":"D","note":null}]'::jsonb,
  778,
  '77888888-8888-4888-8888-888888888888'::uuid
) o;
select
  count(*) filter (where id = (select order_id from owner_page_order)) = 0 as supervisor_orders_page_hides_owner_order,
  count(*) filter (where id = (select order_id from supervisor_page_order)) = 1 as supervisor_orders_page_still_works
from public.orders;

select
  not jsonb_path_exists(
    summary.recent_order_activities,
    '$[*] ? (@.actor_user_id == $owner)',
    jsonb_build_object('owner', (select owner_user_id from owner_identity)::text)
  ) as owner_hidden_from_home_activities
from public.get_backoffice_home_summary() summary;

select
  count(*) filter (where actor_user_id = (select owner_user_id from owner_identity)) = 0 as owner_hidden_from_audit_api
from public.audit_logs;

-- Internal audit retention: Owner's successful role operations remain stored.
set local role postgres;
select
  count(*) >= 2 as owner_operations_remain_in_internal_audit
from public.audit_logs
where actor_user_id = (select owner_user_id from owner_identity)
  and action = 'user_role_changed';

-- Owner remains Admin and active; the attempted changes did not alter it.
select
  role = 'admin'::public.app_role as owner_role_unchanged,
  is_active as owner_active
from public.profiles
where id = (select owner_user_id from owner_identity);

rollback;

-- Expected outcomes:
-- owner_identity_resolved=true
-- owner_identity_matches=true
-- exactly_one_owner_record=true
-- owner_has_all_permissions=true
-- owner_hidden_from_visible_profile_api=true
-- owner_can_read_own_profile=true
-- owner_can_manage_admin=true
-- owner_can_deactivate_admin=true
-- owner_can_reactivate_admin=true
-- owner_hidden_from_profiles_rls=true
-- owner_hidden_from_home_activities=true
-- owner_hidden_from_audit_api=true
-- owner_operations_remain_in_internal_audit=true
-- owner_role_unchanged=true, owner_active=true
