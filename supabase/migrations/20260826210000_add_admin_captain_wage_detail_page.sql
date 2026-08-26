-- Delivery Tartous: paginated admin detail ledger for one captain.
-- Returns a server-filtered page together with complete finance totals for the selected Damascus period.

create or replace function private.get_captain_wage_details_page(
  p_captain_id uuid,
  p_period text default 'daily',
  p_limit integer default 10,
  p_offset integer default 0,
  p_custom_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := lower(coalesce(p_period, 'daily'));
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_today date := timezone('Asia/Damascus', now())::date;
  v_target_date date := coalesce(p_custom_date, timezone('Asia/Damascus', now())::date);
  v_result jsonb;
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view captain wage details' using errcode = '42501';
  end if;

  if p_captain_id is null then
    raise exception 'Captain is required' using errcode = '22023';
  end if;

  if v_period not in ('daily', 'weekly', 'monthly', 'annual') then
    raise exception 'Unsupported wage period: %', v_period using errcode = '22023';
  end if;

  if p_custom_date is not null and p_custom_date > v_today then
    raise exception 'Custom wage date cannot be in the future' using errcode = '22023';
  end if;

  with paid_by_ledger as (
    select
      cpi.financial_ledger_id,
      sum(cpi.captain_amount)::numeric as paid_amount
    from public.captain_payout_items cpi
    group by cpi.financial_ledger_id
  ), latest_allocation as (
    select distinct on (cpi.financial_ledger_id)
      cpi.financial_ledger_id,
      cpi.payout_id,
      cp.paid_at
    from public.captain_payout_items cpi
    join public.captain_payouts cp on cp.id = cpi.payout_id
    order by cpi.financial_ledger_id, cp.paid_at desc, cpi.payout_id desc
  ), base as (
    select
      fl.id as financial_ledger_id,
      fl.order_id,
      o.order_number,
      fl.source_status,
      fl.gross_fee,
      fl.captain_amount,
      fl.company_amount,
      fl.settlement_amount,
      coalesce(o.completed_at, o.false_order_at) as completed_at,
      coalesce(paid.paid_amount, 0)::numeric as paid_amount,
      greatest(fl.captain_amount - coalesce(paid.paid_amount, 0), 0)::numeric as unpaid_amount,
      coalesce(paid.paid_amount, 0) >= fl.captain_amount as is_fully_paid,
      latest.payout_id as latest_payout_id,
      latest.paid_at as latest_paid_at,
      fl.created_at
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
    left join latest_allocation latest on latest.financial_ledger_id = fl.id
    where fl.captain_id = p_captain_id
      and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date <= v_today
      and case
        when p_custom_date is not null then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date = v_target_date
        when v_period = 'daily' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date = v_today
        when v_period = 'weekly' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date >= v_today - 6
        when v_period = 'monthly' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date >= date_trunc('month', v_today)::date
        when v_period = 'annual' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date >= date_trunc('year', v_today)::date
      end
  ), totals as (
    select
      count(*)::integer as total,
      coalesce(sum(gross_fee), 0)::numeric as gross,
      coalesce(sum(captain_amount), 0)::numeric as captain,
      coalesce(sum(company_amount), 0)::numeric as company,
      coalesce(sum(settlement_amount), 0)::numeric as settlement,
      coalesce(sum(paid_amount), 0)::numeric as paid,
      coalesce(sum(unpaid_amount), 0)::numeric as unpaid
    from base
  ), page_rows as (
    select *
    from base
    order by completed_at desc, created_at desc
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'total', totals.total,
    'totals', jsonb_build_object(
      'gross', totals.gross,
      'captain', totals.captain,
      'company', totals.company,
      'settlement', totals.settlement,
      'paid', totals.paid,
      'unpaid', totals.unpaid
    ),
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'financial_ledger_id', page_rows.financial_ledger_id,
            'order_id', page_rows.order_id,
            'order_number', page_rows.order_number,
            'source_status', page_rows.source_status,
            'gross_fee', page_rows.gross_fee,
            'captain_amount', page_rows.captain_amount,
            'company_amount', page_rows.company_amount,
            'settlement_amount', page_rows.settlement_amount,
            'completed_at', page_rows.completed_at,
            'paid_amount', page_rows.paid_amount,
            'unpaid_amount', page_rows.unpaid_amount,
            'is_fully_paid', page_rows.is_fully_paid,
            'latest_payout_id', page_rows.latest_payout_id,
            'latest_paid_at', page_rows.latest_paid_at
          )
          order by page_rows.completed_at desc, page_rows.created_at desc
        )
        from page_rows
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from totals;

  return v_result;
end;
$$;

create or replace function public.get_captain_wage_details_page(
  p_captain_id uuid,
  p_period text default 'daily',
  p_limit integer default 10,
  p_offset integer default 0,
  p_custom_date date default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_captain_wage_details_page(
    p_captain_id,
    p_period,
    p_limit,
    p_offset,
    p_custom_date
  )
$$;

revoke all on function private.get_captain_wage_details_page(uuid, text, integer, integer, date)
  from public, anon;
grant execute on function private.get_captain_wage_details_page(uuid, text, integer, integer, date)
  to authenticated;
revoke all on function public.get_captain_wage_details_page(uuid, text, integer, integer, date)
  from public, anon;
grant execute on function public.get_captain_wage_details_page(uuid, text, integer, integer, date)
  to authenticated;
