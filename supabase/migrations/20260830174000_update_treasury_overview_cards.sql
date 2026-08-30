-- Dashboard values for the treasury screen.
-- The return shape is intentionally recreated because PostgreSQL does not
-- allow CREATE OR REPLACE to change OUT columns.
drop function if exists public.get_treasury_overview();

-- The balance remains the append-only ledger balance; these two fields are
-- display summaries and do not alter any financial records.
create or replace function public.get_treasury_overview()
returns table (
  current_balance numeric,
  company_profit_total numeric,
  capital_in_total numeric,
  withdrawal_total numeric,
  company_profit_today numeric,
  cash_flow_total numeric,
  transaction_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view the treasury' using errcode = '42501';
  end if;

  return query
  select
    s.current_balance,
    coalesce(sum(case when t.transaction_type = 'company_profit_in' then t.amount else 0 end), 0)::numeric,
    coalesce(sum(case when t.transaction_type = 'capital_in' then t.amount else 0 end), 0)::numeric,
    coalesce(sum(case when t.transaction_type = 'withdrawal_out' then t.amount else 0 end), 0)::numeric,
    (
      select coalesce(sum(fl.company_amount), 0)::numeric
      from public.financial_ledger fl
      join public.orders o on o.id = fl.order_id
      where fl.source_status = 'completed'::public.order_status
        and fl.company_amount > 0
        and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
          = (now() at time zone 'Asia/Damascus')::date
    ) - coalesce((
      select sum(e.amount)::numeric
      from public.office_expenses e
      where e.expense_date = (now() at time zone 'Asia/Damascus')::date
    ), 0),
    coalesce(sum(case when t.transaction_type = 'capital_in' then t.amount else 0 end), 0)::numeric
      - coalesce(sum(case when t.transaction_type = 'withdrawal_out' then t.amount else 0 end), 0)::numeric,
    count(t.id)::bigint
  from public.treasury_state s
  left join public.treasury_transactions t on true
  where s.id = true
  group by s.current_balance;
end;
$$;

revoke all on function public.get_treasury_overview() from public, anon;
grant execute on function public.get_treasury_overview() to authenticated;
