-- Delivery Tartous: a single authorised financial summary for the mobile PDF reports.
-- The result uses Damascus business dates and keeps the existing ledger/expense definitions.

create or replace function public.get_company_report_range_summary(
  p_start_date date,
  p_end_date date
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

  if p_start_date is null or p_end_date is null then
    raise exception 'p_start_date and p_end_date are required' using errcode = '22023';
  end if;

  if p_start_date > p_end_date then
    raise exception 'p_start_date must be on or before p_end_date' using errcode = '22023';
  end if;

  return query
  with ledger_totals as (
    select
      count(*)::bigint as orders,
      coalesce(sum(fl.gross_fee), 0)::numeric as gross,
      coalesce(sum(fl.company_amount), 0)::numeric as company,
      coalesce(sum(fl.captain_amount), 0)::numeric as captain
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
      and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
        between p_start_date and p_end_date
  ),
  expense_totals as (
    select coalesce(sum(e.amount), 0)::numeric as expenses
    from public.office_expenses e
    where e.expense_date between p_start_date and p_end_date
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

alter function public.get_company_report_range_summary(date, date) owner to postgres;
revoke all on function public.get_company_report_range_summary(date, date)
  from public, anon, authenticated;
grant execute on function public.get_company_report_range_summary(date, date)
  to authenticated;
