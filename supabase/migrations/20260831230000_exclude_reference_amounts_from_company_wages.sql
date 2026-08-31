-- Reference amounts for medicine and false orders are not actual wages.
-- They remain compensation inputs only.

create or replace function private.get_company_profit_period_history(
  p_period text default 'daily',
  p_limit integer default 30,
  p_before_period_start date default null
)
returns table (
  period_start date,
  period_end date,
  order_count bigint,
  gross_total numeric,
  company_total numeric,
  captain_net_total numeric,
  settlement_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  if p_period is null or p_period not in ('daily', 'weekly', 'monthly', 'annual') then
    raise exception 'p_period must be one of: daily, weekly, monthly, annual' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with ledger_days as (
    select
      (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date as business_day,
      fl.gross_fee,
      private.company_financial_result_for_order(
        o.order_kind,
        fl.source_status::text,
        fl.gross_fee,
        fl.captain_amount,
        fl.company_amount
      ) as company_result,
      fl.captain_amount,
      case
        when fl.source_status = 'false_order' or o.order_kind = 'medicine' then fl.captain_amount
        else 0::numeric
      end as captain_compensation_amount
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
  ),
  periodized_ledger as (
    select
      case p_period
        when 'daily' then ld.business_day
        when 'weekly' then private.saturday_week_start(ld.business_day)
        when 'monthly' then date_trunc('month', ld.business_day::timestamp)::date
        when 'annual' then date_trunc('year', ld.business_day::timestamp)::date
      end as period_start,
      ld.gross_fee,
      ld.company_result,
      ld.captain_amount,
      ld.captain_compensation_amount
    from ledger_days ld
  )
  select
    pl.period_start,
    case p_period
      when 'daily' then pl.period_start
      when 'weekly' then pl.period_start + 6
      when 'monthly' then (pl.period_start + interval '1 month - 1 day')::date
      when 'annual' then (pl.period_start + interval '1 year - 1 day')::date
    end as period_end,
    count(*)::bigint,
    coalesce(sum(case when pl.captain_compensation_amount > 0 then 0 else pl.gross_fee end), 0)::numeric,
    coalesce(sum(pl.company_result), 0)::numeric,
    coalesce(sum(case when pl.captain_compensation_amount > 0 then 0 else pl.captain_amount end), 0)::numeric,
    coalesce(sum(pl.captain_compensation_amount), 0)::numeric
  from periodized_ledger pl
  where p_before_period_start is null
     or pl.period_start < p_before_period_start
  group by pl.period_start
  order by pl.period_start desc
  limit p_limit;
end;
$$;

drop function if exists public.get_company_report_range_summary(date, date);

create function public.get_company_report_range_summary(
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  period_start date,
  period_end date,
  order_count bigint,
  gross_total numeric,
  company_total numeric,
  captain_net_total numeric,
  captain_wage_total numeric,
  captain_compensation_total numeric,
  expense_total numeric,
  net_company_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  if (p_start_date is null) <> (p_end_date is null) then
    raise exception 'p_start_date and p_end_date must be provided together' using errcode = '22023';
  end if;

  if p_start_date is not null and p_start_date > p_end_date then
    raise exception 'p_start_date must be on or before p_end_date' using errcode = '22023';
  end if;

  return query
  with ledger_totals as (
    select
      count(*)::bigint as orders,
      coalesce(sum(case when fl.source_status = 'false_order' or o.order_kind = 'medicine' then 0 else fl.gross_fee end), 0)::numeric as gross,
      coalesce(sum(private.company_financial_result_for_order(
        o.order_kind,
        fl.source_status::text,
        fl.gross_fee,
        fl.captain_amount,
        fl.company_amount
      )), 0)::numeric as company,
      coalesce(sum(case when fl.source_status = 'false_order' or o.order_kind = 'medicine' then 0 else fl.captain_amount end), 0)::numeric as captain,
      coalesce(sum(case
        when fl.source_status = 'false_order' or o.order_kind = 'medicine' then 0::numeric
        else fl.captain_amount
      end), 0)::numeric as captain_wages,
      coalesce(sum(case
        when fl.source_status = 'false_order' or o.order_kind = 'medicine' then fl.captain_amount
        else 0::numeric
      end), 0)::numeric as captain_compensations
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
      and (
        p_start_date is null
        or (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
          between p_start_date and p_end_date
      )
  ),
  expense_totals as (
    select coalesce(sum(e.amount), 0)::numeric as expenses
    from public.office_expenses e
    where p_start_date is null
       or e.expense_date between p_start_date and p_end_date
  )
  select
    p_start_date,
    p_end_date,
    lt.orders,
    lt.gross,
    lt.company,
    lt.captain,
    lt.captain_wages,
    lt.captain_compensations,
    et.expenses,
    (lt.company - et.expenses)::numeric
  from ledger_totals lt
  cross join expense_totals et;
end;
$$;

alter function public.get_company_report_range_summary(date, date) owner to postgres;
revoke all on function public.get_company_report_range_summary(date, date)
  from public, anon, authenticated;
grant execute on function public.get_company_report_range_summary(date, date)
  to authenticated;
