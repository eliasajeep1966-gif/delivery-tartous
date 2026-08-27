-- Medicine and false-order trips are free for the customer, while the company
-- funds the captain's 70% wage. Treat that wage as a company cost in every
-- company-profit calculation. The existing settlement_total response field is
-- retained for client compatibility but now means captain compensation total.

create or replace function private.company_financial_result(
  p_financial_treatment text,
  p_captain_amount numeric,
  p_company_amount numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_financial_treatment = 'false_order' then -coalesce(p_captain_amount, 0)
    else coalesce(p_company_amount, 0)
  end
$$;

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
      private.company_financial_result(
        fl.financial_treatment,
        fl.captain_amount,
        fl.company_amount
      ) as company_result,
      fl.captain_amount,
      case
        when fl.financial_treatment = 'false_order' then fl.captain_amount
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
    coalesce(sum(pl.gross_fee), 0)::numeric,
    coalesce(sum(pl.company_result), 0)::numeric,
    coalesce(sum(pl.captain_amount), 0)::numeric,
    coalesce(sum(pl.captain_compensation_amount), 0)::numeric
  from periodized_ledger pl
  where p_before_period_start is null
     or pl.period_start < p_before_period_start
  group by pl.period_start
  order by pl.period_start desc
  limit p_limit;
end;
$$;

create or replace function public.get_company_expense_period_summary(
  p_period text default 'daily',
  p_limit integer default 100,
  p_before_period_start date default null
)
returns table (
  period_start date,
  period_end date,
  company_gross_total numeric,
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

  if p_period is null or p_period not in ('daily', 'weekly', 'monthly', 'annual') then
    raise exception 'p_period must be daily, weekly, monthly, or annual' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with company_days as (
    select
      (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date as business_day,
      private.company_financial_result(
        fl.financial_treatment,
        fl.captain_amount,
        fl.company_amount
      ) as amount
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
  ),
  entries as (
    select cd.business_day, cd.amount as company_amount, 0::numeric as expense_amount
    from company_days cd
    union all
    select e.expense_date, 0::numeric, e.amount
    from public.office_expenses e
  ),
  grouped as (
    select
      case p_period
        when 'daily' then business_day
        when 'weekly' then private.saturday_week_start(business_day)
        when 'monthly' then date_trunc('month', business_day::timestamp)::date
        when 'annual' then date_trunc('year', business_day::timestamp)::date
      end as period_start,
      sum(company_amount)::numeric as company_amount,
      sum(expense_amount)::numeric as expense_amount
    from entries
    group by 1
  )
  select
    g.period_start,
    case p_period
      when 'daily' then g.period_start
      when 'weekly' then g.period_start + 6
      when 'monthly' then (g.period_start + interval '1 month - 1 day')::date
      when 'annual' then (g.period_start + interval '1 year - 1 day')::date
    end,
    coalesce(g.company_amount, 0),
    coalesce(g.expense_amount, 0),
    coalesce(g.company_amount, 0) - coalesce(g.expense_amount, 0)
  from grouped g
  where p_before_period_start is null or g.period_start < p_before_period_start
  order by g.period_start desc
  limit p_limit;
end;
$$;

create or replace function public.get_company_report_range_summary(
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
      coalesce(sum(fl.gross_fee), 0)::numeric as gross,
      coalesce(sum(private.company_financial_result(
        fl.financial_treatment,
        fl.captain_amount,
        fl.company_amount
      )), 0)::numeric as company,
      coalesce(sum(fl.captain_amount), 0)::numeric as captain
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
    et.expenses,
    (lt.company - et.expenses)::numeric
  from ledger_totals lt
  cross join expense_totals et;
end;
$$;
