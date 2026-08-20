-- Delivery Tartous: partial captain payouts with server-side FIFO allocation.
-- Local-only migration. Do not apply without explicit owner approval.
-- One captain_payouts row remains the payout header; captain_payout_items are allocations.

alter table public.captain_payout_items
  drop constraint if exists captain_payout_items_financial_ledger_id_key;

create or replace function private.create_captain_payout(
  p_captain_id uuid,
  p_financial_ledger_ids uuid[],
  p_notes text default null
)
returns public.captain_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.captain_payouts;
  v_ledger public.financial_ledger;
  v_total numeric(12, 2) := 0;
  v_selected_count integer := 0;
  v_unique_count integer := 0;
  v_captain_profile_id uuid;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if not private.has_permission('manage_captain_payouts') then
    raise exception 'Current user is not allowed to record captain payouts' using errcode = '42501';
  end if;

  if p_captain_id is null or coalesce(cardinality(p_financial_ledger_ids), 0) = 0 then
    raise exception 'A captain and at least one wage record are required' using errcode = '22023';
  end if;

  select id
  into v_captain_profile_id
  from public.profiles
  where id = p_captain_id
    and role = 'captain'::public.app_role
  for update;

  if not found then
    raise exception 'Payouts can only be recorded for a captain' using errcode = '22023';
  end if;

  select count(*) into v_unique_count
  from (select distinct unnest(p_financial_ledger_ids) as id) ids;

  if v_unique_count <> cardinality(p_financial_ledger_ids) then
    raise exception 'A wage record cannot be selected more than once' using errcode = '22023';
  end if;

  if v_notes is not null and length(v_notes) > 500 then
    raise exception 'Payout notes must be 500 characters or fewer' using errcode = '22023';
  end if;

  for v_ledger in
    select *
    from public.financial_ledger
    where id = any(p_financial_ledger_ids)
    order by created_at asc, id asc
    for update
  loop
    if v_ledger.captain_id <> v_captain_profile_id then
      raise exception 'Every selected wage record must belong to the same captain' using errcode = '22023';
    end if;

    -- Legacy full payouts remain full-only: any prior allocation blocks the selection.
    if exists (
      select 1
      from public.captain_payout_items
      where financial_ledger_id = v_ledger.id
    ) then
      raise exception 'A selected wage record already has a payout allocation' using errcode = '22023';
    end if;

    v_selected_count := v_selected_count + 1;
    v_total := v_total + v_ledger.captain_amount;
  end loop;

  if v_selected_count <> cardinality(p_financial_ledger_ids) then
    raise exception 'One or more selected wage records were not found' using errcode = 'P0002';
  end if;

  insert into public.captain_payouts (
    captain_id,
    total_amount,
    paid_by_user_id,
    notes
  )
  values (
    v_captain_profile_id,
    v_total,
    (select auth.uid()),
    v_notes
  )
  returning * into v_payout;

  insert into public.captain_payout_items (
    payout_id,
    financial_ledger_id,
    captain_amount
  )
  select
    v_payout.id,
    fl.id,
    fl.captain_amount
  from public.financial_ledger fl
  where fl.id = any(p_financial_ledger_ids);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'captain_payout_recorded',
    'captain_payout',
    v_payout.id,
    jsonb_build_object(
      'captain_id', v_captain_profile_id,
      'total_amount', v_payout.total_amount,
      'financial_ledger_count', v_selected_count
    )
  );

  return v_payout;
end;
$$;

create or replace function private.create_captain_partial_payout(
  p_captain_id uuid,
  p_amount numeric,
  p_notes text default null
)
returns public.captain_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.captain_payouts;
  v_ledger public.financial_ledger;
  v_captain_profile_id uuid;
  v_amount numeric;
  v_total_unpaid numeric;
  v_remaining_to_pay numeric(12, 2);
  v_ledger_remaining numeric(12, 2);
  v_allocation numeric(12, 2);
  v_allocation_count integer := 0;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if not private.has_permission('manage_captain_payouts') then
    raise exception 'Current user is not allowed to record captain payouts' using errcode = '42501';
  end if;

  if p_captain_id is null or p_amount is null then
    raise exception 'A captain and payout amount are required' using errcode = '22023';
  end if;

  -- PostgreSQL numeric supports NaN and infinity. Reject non-finite values before arithmetic or rounding.
  if p_amount = 'NaN'::numeric
     or p_amount = 'Infinity'::numeric
     or p_amount = '-Infinity'::numeric then
    raise exception 'Payout amount must be a positive finite value with at most two decimal places' using errcode = '22023';
  end if;

  v_amount := round(p_amount, 2);

  if p_amount <> v_amount
     or v_amount <= 0
     or v_amount > 9999999999.99::numeric then
    raise exception 'Payout amount must be positive, finite, fit the supported precision, and have at most two decimal places' using errcode = '22023';
  end if;

  if v_notes is not null and length(v_notes) > 500 then
    raise exception 'Payout notes must be 500 characters or fewer' using errcode = '22023';
  end if;

  -- This row lock is shared with the legacy full-payout function above. It serializes
  -- all payout recording for one captain and prevents concurrent over-allocation.
  select id
  into v_captain_profile_id
  from public.profiles
  where id = p_captain_id
    and role = 'captain'::public.app_role
  for update;

  if not found then
    raise exception 'Payouts can only be recorded for a captain' using errcode = '22023';
  end if;

  select coalesce(sum(greatest(fl.captain_amount - coalesce(paid.paid_amount, 0), 0)), 0)::numeric(12, 2)
  into v_total_unpaid
  from public.financial_ledger fl
  left join (
    select financial_ledger_id, sum(captain_amount)::numeric as paid_amount
    from public.captain_payout_items
    group by financial_ledger_id
  ) paid on paid.financial_ledger_id = fl.id
  where fl.captain_id = v_captain_profile_id;

  if v_amount > v_total_unpaid then
    raise exception 'Payout amount exceeds the captain unpaid balance' using errcode = '22023';
  end if;

  insert into public.captain_payouts (
    captain_id,
    total_amount,
    paid_by_user_id,
    notes
  )
  values (
    v_captain_profile_id,
    v_amount,
    (select auth.uid()),
    v_notes
  )
  returning * into v_payout;

  v_remaining_to_pay := v_amount;

  for v_ledger in
    with paid_by_ledger as (
      select financial_ledger_id, sum(captain_amount)::numeric as paid_amount
      from public.captain_payout_items
      group by financial_ledger_id
    )
    select fl.*
    from public.financial_ledger fl
    left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
    where fl.captain_id = v_captain_profile_id
      and fl.captain_amount > coalesce(paid.paid_amount, 0)
    order by fl.created_at asc, fl.id asc
    for update of fl
  loop
    select greatest(v_ledger.captain_amount - coalesce(sum(cpi.captain_amount), 0), 0)::numeric(12, 2)
    into v_ledger_remaining
    from public.captain_payout_items cpi
    where cpi.financial_ledger_id = v_ledger.id;

    if v_ledger_remaining <= 0 then
      continue;
    end if;

    v_allocation := least(v_remaining_to_pay, v_ledger_remaining)::numeric(12, 2);

    insert into public.captain_payout_items (
      payout_id,
      financial_ledger_id,
      captain_amount
    )
    values (
      v_payout.id,
      v_ledger.id,
      v_allocation
    );

    v_remaining_to_pay := (v_remaining_to_pay - v_allocation)::numeric(12, 2);
    v_allocation_count := v_allocation_count + 1;

    exit when v_remaining_to_pay = 0;
  end loop;

  if v_remaining_to_pay <> 0 then
    raise exception 'Payout could not be allocated completely' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'captain_partial_payout_recorded',
    'captain_payout',
    v_payout.id,
    jsonb_build_object(
      'captain_id', v_captain_profile_id,
      'total_amount', v_payout.total_amount,
      'allocation_count', v_allocation_count
    )
  );

  return v_payout;
end;
$$;

create or replace function private.get_wage_totals()
returns table (
  gross_total numeric,
  captain_net_total numeric,
  company_total numeric,
  settlement_total numeric,
  paid_total numeric,
  unpaid_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  return query
  with paid_by_ledger as (
    select financial_ledger_id, sum(captain_amount)::numeric as paid_amount
    from public.captain_payout_items
    group by financial_ledger_id
  ), ledger_balances as (
    select
      fl.gross_fee,
      fl.captain_amount,
      fl.company_amount,
      fl.settlement_amount,
      coalesce(paid.paid_amount, 0)::numeric as paid_amount
    from public.financial_ledger fl
    left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
  )
  select
    coalesce(sum(gross_fee), 0)::numeric,
    coalesce(sum(captain_amount), 0)::numeric,
    coalesce(sum(company_amount), 0)::numeric,
    coalesce(sum(settlement_amount), 0)::numeric,
    coalesce(sum(least(paid_amount, captain_amount)), 0)::numeric,
    coalesce(sum(greatest(captain_amount - paid_amount, 0)), 0)::numeric
  from ledger_balances;
end;
$$;

create or replace function private.get_captain_wage_summary(
  p_captain_id uuid default null
)
returns table (
  captain_id uuid,
  captain_name text,
  order_count bigint,
  gross_total numeric,
  captain_net_total numeric,
  paid_total numeric,
  unpaid_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  return query
  with paid_by_ledger as (
    select financial_ledger_id, sum(captain_amount)::numeric as paid_amount
    from public.captain_payout_items
    group by financial_ledger_id
  ), ledger_balances as (
    select
      fl.captain_id,
      fl.gross_fee,
      fl.captain_amount,
      coalesce(paid.paid_amount, 0)::numeric as paid_amount
    from public.financial_ledger fl
    left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
    where p_captain_id is null or fl.captain_id = p_captain_id
  )
  select
    lb.captain_id,
    p.full_name,
    count(*)::bigint,
    coalesce(sum(lb.gross_fee), 0)::numeric,
    coalesce(sum(lb.captain_amount), 0)::numeric,
    coalesce(sum(least(lb.paid_amount, lb.captain_amount)), 0)::numeric,
    coalesce(sum(greatest(lb.captain_amount - lb.paid_amount, 0)), 0)::numeric
  from ledger_balances lb
  join public.profiles p on p.id = lb.captain_id
  group by lb.captain_id, p.full_name
  order by p.full_name nulls last, lb.captain_id;
end;
$$;

create or replace function private.get_captain_wage_details_v2(
  p_captain_id uuid
)
returns table (
  financial_ledger_id uuid,
  order_id uuid,
  order_number bigint,
  source_status public.order_status,
  gross_fee numeric,
  captain_amount numeric,
  company_amount numeric,
  settlement_amount numeric,
  completed_at timestamptz,
  paid_amount numeric,
  unpaid_amount numeric,
  is_fully_paid boolean,
  latest_payout_id uuid,
  latest_paid_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  return query
  with paid_by_ledger as (
    select financial_ledger_id, sum(captain_amount)::numeric as paid_amount
    from public.captain_payout_items
    group by financial_ledger_id
  ), latest_allocation as (
    select distinct on (cpi.financial_ledger_id)
      cpi.financial_ledger_id,
      cpi.payout_id,
      cp.paid_at
    from public.captain_payout_items cpi
    join public.captain_payouts cp on cp.id = cpi.payout_id
    order by cpi.financial_ledger_id, cp.paid_at desc, cpi.payout_id desc
  )
  select
    fl.id,
    fl.order_id,
    o.order_number,
    fl.source_status,
    fl.gross_fee,
    fl.captain_amount,
    fl.company_amount,
    fl.settlement_amount,
    coalesce(o.completed_at, o.false_order_at),
    coalesce(paid.paid_amount, 0)::numeric,
    greatest(fl.captain_amount - coalesce(paid.paid_amount, 0), 0)::numeric,
    coalesce(paid.paid_amount, 0) >= fl.captain_amount,
    latest.payout_id,
    latest.paid_at
  from public.financial_ledger fl
  join public.orders o on o.id = fl.order_id
  left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
  left join latest_allocation latest on latest.financial_ledger_id = fl.id
  where fl.captain_id = p_captain_id
  order by coalesce(o.completed_at, o.false_order_at) desc, fl.created_at desc;
end;
$$;

create or replace function public.get_wage_totals()
returns table (
  gross_total numeric,
  captain_net_total numeric,
  company_total numeric,
  settlement_total numeric,
  paid_total numeric,
  unpaid_total numeric
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_wage_totals()
$$;

create or replace function public.get_captain_wage_summary(
  p_captain_id uuid default null
)
returns table (
  captain_id uuid,
  captain_name text,
  order_count bigint,
  gross_total numeric,
  captain_net_total numeric,
  paid_total numeric,
  unpaid_total numeric
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_captain_wage_summary(p_captain_id)
$$;

create or replace function public.create_captain_partial_payout(
  p_captain_id uuid,
  p_amount numeric,
  p_notes text default null
)
returns public.captain_payouts
language sql
security invoker
set search_path = ''
as $$
  select private.create_captain_partial_payout(p_captain_id, p_amount, p_notes)
$$;

create or replace function public.get_captain_wage_details_v2(
  p_captain_id uuid
)
returns table (
  financial_ledger_id uuid,
  order_id uuid,
  order_number bigint,
  source_status public.order_status,
  gross_fee numeric,
  captain_amount numeric,
  company_amount numeric,
  settlement_amount numeric,
  completed_at timestamptz,
  paid_amount numeric,
  unpaid_amount numeric,
  is_fully_paid boolean,
  latest_payout_id uuid,
  latest_paid_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_captain_wage_details_v2(p_captain_id)
$$;

revoke all on function private.create_captain_partial_payout(uuid, numeric, text) from public, anon;
revoke all on function private.get_captain_wage_details_v2(uuid) from public, anon;
grant execute on function private.create_captain_partial_payout(uuid, numeric, text) to authenticated;
grant execute on function private.get_captain_wage_details_v2(uuid) to authenticated;

revoke all on function public.create_captain_partial_payout(uuid, numeric, text) from public, anon;
revoke all on function public.get_captain_wage_details_v2(uuid) from public, anon;
grant execute on function public.create_captain_partial_payout(uuid, numeric, text) to authenticated;
grant execute on function public.get_captain_wage_details_v2(uuid) to authenticated;
