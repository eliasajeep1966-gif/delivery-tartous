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
      fl.company_amount as amount
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
        when 'weekly' then date_trunc('week', business_day::timestamp)::date
        when 'monthly' then date_trunc('month', business_day::timestamp)::date
        when 'annual' then date_trunc('year', business_day::timestamp)::date
      end as period_start,
      sum(company_amount)::numeric as company_amount,
      sum(expense_amount)::numeric as expense_amount
    from entries
    group by 1
  )
  select g.period_start,
    case p_period
      when 'daily' then g.period_start
      when 'weekly' then g.period_start + 6
      when 'monthly' then (g.period_start + interval '1 month - 1 day')::date
      when 'annual' then (g.period_start + interval '1 year - 1 day')::date
    end,
    coalesce(g.company_amount, 0), coalesce(g.expense_amount, 0),
    coalesce(g.company_amount, 0) - coalesce(g.expense_amount, 0)
  from grouped g
  where p_before_period_start is null or g.period_start < p_before_period_start
  order by g.period_start desc
  limit p_limit;
end;
$$;

revoke all on function public.get_company_expense_period_summary(text, integer, date) from public, anon;
grant execute on function public.get_company_expense_period_summary(text, integer, date) to authenticated;
