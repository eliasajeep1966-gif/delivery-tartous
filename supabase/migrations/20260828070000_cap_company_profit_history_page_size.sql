-- Always cap the public company-profit history RPC to five periods.
-- Keep the p_limit argument in the signature for backward compatibility with older app builds,
-- but intentionally ignore it so clients cannot request an unbounded history page.
create or replace function public.get_company_profit_period_history(
  p_period text default 'daily',
  p_limit integer default 5,
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
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.get_company_profit_period_history(
    p_period,
    5,
    p_before_period_start
  )
$$;

revoke all on function public.get_company_profit_period_history(text, integer, date)
  from public, anon;
grant execute on function public.get_company_profit_period_history(text, integer, date)
  to authenticated;
