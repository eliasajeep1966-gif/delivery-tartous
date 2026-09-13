-- Restore the legacy medicine compensation treatment through the explicit
-- distribution-exception field only. Source notes remain descriptive.
-- Existing ledger rows are not changed.

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
  v_compensation boolean := false;
begin
  if private.current_user_role() is distinct from 'captain'::public.app_role then
    raise exception 'Only an active captain can perform this order transition' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if v_order.assigned_captain_id is distinct from (select auth.uid()) then
    raise exception 'Only the assigned captain can change this order' using errcode = '42501';
  end if;

  case p_next_status
    when 'received'::public.order_status then
      v_required_permission := 'receive_assigned_order';
      if v_order.status <> 'assigned'::public.order_status then
        raise exception 'Only an assigned order can be marked received' using errcode = '22023';
      end if;
    when 'in_delivery'::public.order_status then
      v_required_permission := 'start_assigned_delivery';
      if v_order.status <> 'received'::public.order_status then
        raise exception 'Only a received order can be started' using errcode = '22023';
      end if;
    when 'completed'::public.order_status then
      v_required_permission := 'complete_assigned_order';
      if v_order.status <> 'in_delivery'::public.order_status then
        raise exception 'Only an in-delivery order can be completed' using errcode = '22023';
      end if;
    when 'false_order'::public.order_status then
      v_required_permission := 'mark_assigned_order_false';
      if v_order.status not in (
        'assigned'::public.order_status,
        'received'::public.order_status,
        'in_delivery'::public.order_status
      ) then
        raise exception 'This order cannot be marked false from its current status' using errcode = '22023';
      end if;
    else
      raise exception 'Captains cannot perform the requested target status' using errcode = '22023';
  end case;

  if not private.has_permission(v_required_permission) then
    raise exception 'Current captain does not have the required permission' using errcode = '42501';
  end if;

  v_previous_status := v_order.status;
  update public.orders
  set status = p_next_status,
      received_at = case when p_next_status = 'received'::public.order_status then now() else received_at end,
      completed_at = case when p_next_status = 'completed'::public.order_status then now() else completed_at end,
      false_order_at = case when p_next_status = 'false_order'::public.order_status then now() else false_order_at end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (
    order_id, previous_status, next_status, changed_by_user_id, note
  ) values (
    v_order.id, v_previous_status, p_next_status, (select auth.uid()), 'Captain transition'
  );

  if p_next_status in ('completed'::public.order_status, 'false_order'::public.order_status) then
    select item into v_exception
    from public.office_settings settings
    cross join lateral jsonb_array_elements(settings.distribution_exceptions) item
    where settings.id = true
      and nullif(btrim(v_order.distribution_exception_keyword), '') is not null
      and lower(btrim(item ->> 'keyword')) = lower(btrim(v_order.distribution_exception_keyword))
    limit 1;

    -- Keep explicitly-created medicine orders compatible with the old treatment.
    -- The Exceptions-field keyword is a permanent built-in trigger and does not
    -- depend on an office-settings exception row or percentage.
    v_compensation := v_order.order_kind = 'medicine'
      or lower(btrim(v_order.distribution_exception_keyword)) = 'دواء';

    if v_compensation and v_order.order_kind is distinct from 'medicine' then
      update public.orders
      set order_kind = 'medicine'
      where id = v_order.id
      returning * into v_order;
    end if;

    v_company_share := case
      when v_compensation then 30
      else coalesce((v_exception ->> 'office')::numeric, 30)
    end;
    v_captain_amount := round(v_order.fee * (100 - v_company_share) / 100, 2);

    insert into public.financial_ledger (
      order_id,
      captain_id,
      source_status,
      gross_fee,
      captain_amount,
      company_amount,
      settlement_amount,
      financial_treatment
    ) values (
      v_order.id,
      v_order.assigned_captain_id,
      p_next_status,
      v_order.fee,
      v_captain_amount,
      case
        when p_next_status = 'completed'::public.order_status and not v_compensation
          then v_order.fee - v_captain_amount
        else 0
      end,
      case
        when p_next_status = 'false_order'::public.order_status or v_compensation
          then v_order.fee - v_captain_amount
        else 0
      end,
      case when v_compensation then 'false_order' else 'standard' end
    );
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'order_status_changed',
    'order',
    v_order.id,
    jsonb_build_object(
      'from_status', v_previous_status::text,
      'to_status', p_next_status::text,
      'distribution_exception_keyword', v_order.distribution_exception_keyword,
      'medicine_compensation', v_compensation
    )
  );

  return v_order;
end;
$$;

revoke all on function private.transition_assigned_order(uuid, public.order_status) from public, anon;
grant execute on function private.transition_assigned_order(uuid, public.order_status) to authenticated;
