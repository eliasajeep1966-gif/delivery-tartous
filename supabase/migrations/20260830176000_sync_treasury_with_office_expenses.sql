-- Keep the cashbox balance aligned with the company's net profit.
-- Treasury profit entries are gross company earnings; office expenses reduce
-- the accumulated balance through this synchronized calculation.
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
    coalesce(sum(case when t.transaction_type = 'company_profit_in' then t.amount else 0 end), 0)
    + coalesce(sum(case when t.transaction_type = 'capital_in' then t.amount else 0 end), 0)
    - coalesce(sum(case when t.transaction_type = 'withdrawal_out' then t.amount else 0 end), 0)
    - coalesce((select sum(e.amount) from public.office_expenses e), 0)
  into v_balance
  from public.treasury_transactions t;

  update public.treasury_state
  set current_balance = v_balance,
      updated_at = now()
  where id = true;

  return v_balance;
end;
$$;

create or replace function private.sync_treasury_after_office_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_treasury_balance();
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_treasury_after_office_expense on public.office_expenses;
create trigger sync_treasury_after_office_expense
after insert or update or delete on public.office_expenses
for each row execute function private.sync_treasury_after_office_expense();

select private.sync_treasury_balance();

revoke all on function private.sync_treasury_balance() from public, anon;
revoke all on function private.sync_treasury_after_office_expense() from public, anon;
grant execute on function private.sync_treasury_balance() to authenticated;
