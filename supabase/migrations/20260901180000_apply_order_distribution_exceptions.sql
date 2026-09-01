-- Apply an explicitly selected office distribution exception to the order's
-- financial ledger at completion. Source notes remain independent.
alter table public.orders
  add column if not exists distribution_exception_keyword text;

alter table public.financial_ledger
drop constraint if exists financial_ledger_delivery_split;

alter table public.financial_ledger
add constraint financial_ledger_delivery_split check (
  (source_status = 'completed'
    and captain_amount + company_amount + settlement_amount = gross_fee)
  or
  (source_status = 'false_order'
    and captain_amount + settlement_amount = gross_fee
    and company_amount = 0)
);

create or replace function private.prevent_non_admin_exception_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_role() is distinct from 'admin'::public.app_role then
    if exists (
      select 1
      from jsonb_array_elements(old.distribution_exceptions) old_item
      where not exists (
        select 1
        from jsonb_array_elements(new.distribution_exceptions) new_item
        where nullif(btrim(new_item ->> 'id'), '') = nullif(btrim(old_item ->> 'id'), '')
      )
    ) then
      raise exception 'Only an admin can delete an office distribution exception' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists office_settings_exception_deletion_guard on public.office_settings;
create trigger office_settings_exception_deletion_guard
before update of distribution_exceptions on public.office_settings
for each row execute procedure private.prevent_non_admin_exception_deletion();

alter function private.prevent_non_admin_exception_deletion() owner to postgres;
revoke all on function private.prevent_non_admin_exception_deletion() from public, anon, authenticated;

create or replace function private.create_order_with_stops(
  p_stops jsonb,
  p_fee numeric,
  p_idempotency_key text,
  p_exception_keyword text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(btrim(p_idempotency_key), '');
  v_order public.orders;
begin
  if v_key is not null and length(v_key) > 200 then
    raise exception 'Idempotency key is too long' using errcode = '22023';
  end if;
  if v_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended((select auth.uid())::text || ':' || v_key, 0)
    );
    select * into v_order
    from public.orders
    where created_by_user_id = (select auth.uid())
      and idempotency_key = v_key
    limit 1;
    if found then return v_order; end if;
  end if;

  v_order := private.create_order_with_stops(p_stops, p_fee);
  update public.orders
  set idempotency_key = v_key,
      order_kind = 'multi_stop',
      distribution_exception_keyword = nullif(btrim(p_exception_keyword), '')
  where id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.create_order_with_stops(
  p_stops jsonb,
  p_fee numeric,
  p_idempotency_key text,
  p_exception_keyword text default null
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.create_order_with_stops(p_stops, p_fee, p_idempotency_key, p_exception_keyword)
$$;

revoke all on function private.create_order_with_stops(jsonb, numeric, text, text) from public, anon;
grant execute on function private.create_order_with_stops(jsonb, numeric, text, text) to authenticated;
revoke all on function public.create_order_with_stops(jsonb, numeric, text, text) from public, anon;
grant execute on function public.create_order_with_stops(jsonb, numeric, text, text) to authenticated;

create or replace function private.transition_assigned_order(
  p_order_id uuid,
  p_next_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_previous_status public.order_status;
  v_required_permission text;
  v_captain_amount numeric(12, 2);
  v_company_share numeric(5, 2);
  v_exception jsonb;
begin
  if private.current_user_role() is distinct from 'captain'::public.app_role then
    raise exception 'Only an active captain can perform this order transition' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.assigned_captain_id is distinct from (select auth.uid()) then
    raise exception 'Only the assigned captain can change this order' using errcode = '42501';
  end if;

  case p_next_status
    when 'received'::public.order_status then
      v_required_permission := 'receive_assigned_order';
      if v_order.status <> 'assigned'::public.order_status then raise exception 'Only an assigned order can be marked received' using errcode = '22023'; end if;
    when 'in_delivery'::public.order_status then
      v_required_permission := 'start_assigned_delivery';
      if v_order.status <> 'received'::public.order_status then raise exception 'Only a received order can be started' using errcode = '22023'; end if;
    when 'completed'::public.order_status then
      v_required_permission := 'complete_assigned_order';
      if v_order.status <> 'in_delivery'::public.order_status then raise exception 'Only an in-delivery order can be completed' using errcode = '22023'; end if;
    when 'false_order'::public.order_status then
      v_required_permission := 'mark_assigned_order_false';
      if v_order.status not in ('assigned'::public.order_status, 'received'::public.order_status, 'in_delivery'::public.order_status) then raise exception 'This order cannot be marked false from its current status' using errcode = '22023'; end if;
    else raise exception 'Captains cannot perform the requested target status' using errcode = '22023';
  end case;
  if not private.has_permission(v_required_permission) then raise exception 'Current captain does not have the required permission' using errcode = '42501'; end if;

  v_previous_status := v_order.status;
  update public.orders
  set status = p_next_status,
      received_at = case when p_next_status = 'received'::public.order_status then now() else received_at end,
      completed_at = case when p_next_status = 'completed'::public.order_status then now() else completed_at end,
      false_order_at = case when p_next_status = 'false_order'::public.order_status then now() else false_order_at end
  where id = p_order_id returning * into v_order;

  insert into public.order_status_history (order_id, previous_status, next_status, changed_by_user_id, note)
  values (v_order.id, v_previous_status, p_next_status, (select auth.uid()), 'Captain transition');

  if p_next_status in ('completed'::public.order_status, 'false_order'::public.order_status) then
    select item into v_exception
    from public.office_settings settings
    cross join lateral jsonb_array_elements(settings.distribution_exceptions) item
    where settings.id = true
      and nullif(btrim(v_order.distribution_exception_keyword), '') is not null
      and lower(btrim(item ->> 'keyword')) = lower(btrim(v_order.distribution_exception_keyword))
    limit 1;

    v_company_share := coalesce((v_exception ->> 'office')::numeric, 30);
    v_captain_amount := round(v_order.fee * (100 - v_company_share) / 100, 2);

    insert into public.financial_ledger (
      order_id, captain_id, source_status, gross_fee, captain_amount, company_amount, settlement_amount
    ) values (
      v_order.id,
      v_order.assigned_captain_id,
      p_next_status,
      v_order.fee,
      v_captain_amount,
      case when p_next_status = 'completed'::public.order_status then v_order.fee - v_captain_amount else 0 end,
      case when p_next_status = 'false_order'::public.order_status then v_order.fee - v_captain_amount else 0 end
    );
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()), 'order_status_changed', 'order', v_order.id,
    jsonb_build_object('from_status', v_previous_status::text, 'to_status', p_next_status::text, 'distribution_exception_keyword', v_order.distribution_exception_keyword)
  );
  return v_order;
end;
$$;

revoke all on function private.transition_assigned_order(uuid, public.order_status) from public, anon;
grant execute on function private.transition_assigned_order(uuid, public.order_status) to authenticated;
