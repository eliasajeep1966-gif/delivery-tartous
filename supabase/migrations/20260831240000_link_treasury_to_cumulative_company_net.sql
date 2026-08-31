-- Link the cumulative treasury balance to the company's actual net result.
-- Medicine and false-order amounts are compensation references, not wages.

create or replace function private.sync_treasury_balance()
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric;
begin
  select
    coalesce((
      select sum(
        private.company_financial_result_for_order(
          o.order_kind,
          fl.source_status::text,
          fl.gross_fee,
          fl.captain_amount,
          fl.company_amount
        )
      )
      from public.financial_ledger fl
      join public.orders o on o.id = fl.order_id
      where coalesce(o.completed_at, o.false_order_at) is not null
    ), 0)
    + coalesce((select sum(t.amount) from public.treasury_transactions t
                where t.transaction_type = 'capital_in'::public.treasury_transaction_type), 0)
    - coalesce((select sum(t.amount) from public.treasury_transactions t
                where t.transaction_type = 'withdrawal_out'::public.treasury_transaction_type), 0)
    - coalesce((select sum(e.amount) from public.office_expenses e), 0)
  into v_balance;

  update public.treasury_state
  set current_balance = round(v_balance, 2),
      updated_at = now()
  where id = true;

  return round(v_balance, 2);
end;
$$;

create or replace function private.record_completed_order_profit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_result numeric;
begin
  if new.source_status = 'completed'::public.order_status then
    select private.company_financial_result_for_order(
      o.order_kind,
      new.source_status::text,
      new.gross_fee,
      new.captain_amount,
      new.company_amount
    )
    into v_company_result
    from public.orders o
    where o.id = new.order_id;

    if coalesce(v_company_result, 0) > 0 then
      perform private.append_treasury_transaction(
        'company_profit_in'::public.treasury_transaction_type,
        v_company_result,
        'ربح شركة من طلب مكتمل',
        null,
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists financial_ledger_treasury_after_insert on public.financial_ledger;
create trigger financial_ledger_treasury_after_insert
after insert on public.financial_ledger
for each row execute procedure private.record_completed_order_profit();

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

  perform private.sync_treasury_balance();

  return query
  with ledger_company as (
    select
      coalesce(sum(
        private.company_financial_result_for_order(
          o.order_kind,
          fl.source_status::text,
          fl.gross_fee,
          fl.captain_amount,
          fl.company_amount
        )
      ), 0)::numeric as company_total,
      coalesce(sum(case
        when (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
          = (now() at time zone 'Asia/Damascus')::date
        then private.company_financial_result_for_order(
          o.order_kind,
          fl.source_status::text,
          fl.gross_fee,
          fl.captain_amount,
          fl.company_amount
        )
        else 0
      end), 0)::numeric as company_today
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
  ), expenses as (
    select coalesce(sum(e.amount), 0)::numeric as expense_total
    from public.office_expenses e
  )
  select
    s.current_balance,
    (lc.company_total - ex.expense_total)::numeric,
    coalesce(sum(case when t.transaction_type = 'capital_in'::public.treasury_transaction_type then t.amount else 0 end), 0)::numeric,
    coalesce(sum(case when t.transaction_type = 'withdrawal_out'::public.treasury_transaction_type then t.amount else 0 end), 0)::numeric,
    (lc.company_today - coalesce((select sum(e.amount) from public.office_expenses e
      where e.expense_date = (now() at time zone 'Asia/Damascus')::date), 0))::numeric,
    (coalesce(sum(case when t.transaction_type = 'capital_in'::public.treasury_transaction_type then t.amount else 0 end), 0)
      - coalesce(sum(case when t.transaction_type = 'withdrawal_out'::public.treasury_transaction_type then t.amount else 0 end), 0))::numeric,
    count(t.id)::bigint
  from public.treasury_state s
  cross join ledger_company lc
  cross join expenses ex
  left join public.treasury_transactions t on true
  where s.id = true
  group by s.current_balance, lc.company_total, lc.company_today, ex.expense_total;
end;
$$;

select private.sync_treasury_balance();
