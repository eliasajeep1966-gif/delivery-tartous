-- Captain wage periods:
-- * weekly windows are fixed seven-day cycles anchored to each captain's first ledger-backed order;
-- * monthly windows follow the calendar month and expose their actual range to clients.

create or replace function private.get_my_captain_wage_page(
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
  v_captain_id uuid := auth.uid();
  v_period text := lower(coalesce(p_period, 'daily'));
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_today date := timezone('Asia/Damascus', now())::date;
  v_target_date date := coalesce(p_custom_date, timezone('Asia/Damascus', now())::date);
  v_first_order_date date;
  v_period_start date;
  v_period_end date;
  v_result jsonb;
begin
  if private.current_user_role() <> 'captain'::public.app_role then
    raise exception 'Current user is not allowed to view captain wages' using errcode = '42501';
  end if;

  if v_captain_id is null then
    raise exception 'Authenticated captain is required' using errcode = '42501';
  end if;

  if v_period not in ('daily', 'weekly', 'monthly') then
    raise exception 'Unsupported wage period: %', v_period using errcode = '22023';
  end if;

  if p_custom_date is not null and p_custom_date > v_today then
    raise exception 'Custom wage date cannot be in the future' using errcode = '22023';
  end if;

  if p_custom_date is not null then
    v_period_start := v_target_date;
    v_period_end := v_target_date;
  elsif v_period = 'daily' then
    v_period_start := v_today;
    v_period_end := v_today;
  elsif v_period = 'weekly' then
    select min((coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date)
      into v_first_order_date
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where fl.captain_id = v_captain_id
      and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date <= v_today;

    v_first_order_date := coalesce(v_first_order_date, v_today);
    v_period_start := v_first_order_date
      + (((v_today - v_first_order_date) / 7)::integer * 7);
    v_period_end := v_period_start + 6;
  else
    v_period_start := date_trunc('month', v_today)::date;
    v_period_end := (v_period_start + interval '1 month - 1 day')::date;
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
    where fl.captain_id = v_captain_id
      and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
        between v_period_start and least(v_period_end, v_today)
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
    'period_start', v_period_start,
    'period_end', v_period_end,
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

create or replace function public.get_my_captain_wage_page(
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
  select private.get_my_captain_wage_page(
    p_period,
    p_limit,
    p_offset,
    p_custom_date
  )
$$;

revoke all on function private.get_my_captain_wage_page(text, integer, integer, date)
  from public, anon;
grant execute on function private.get_my_captain_wage_page(text, integer, integer, date)
  to authenticated;
revoke all on function public.get_my_captain_wage_page(text, integer, integer, date)
  from public, anon;
grant execute on function public.get_my_captain_wage_page(text, integer, integer, date)
  to authenticated;
