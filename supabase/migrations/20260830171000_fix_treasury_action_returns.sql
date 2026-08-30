-- Return treasury mutations as one-row tables, matching the mobile RPC contract.
-- No treasury data is changed by this migration.

drop function if exists public.create_treasury_deposit(numeric, text);
drop function if exists public.create_treasury_withdrawal(numeric, text);

create or replace function public.create_treasury_deposit(
  p_amount numeric,
  p_notes text default null
)
returns table (
  id uuid,
  admin_id uuid,
  transaction_type public.treasury_transaction_type,
  amount numeric,
  running_balance numeric,
  notes text,
  source_financial_ledger_id uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_treasury_admin();
  return query
  select t.id, t.admin_id, t.transaction_type, t.amount, t.running_balance,
    t.notes, t.source_financial_ledger_id, t.created_at
  from private.append_treasury_transaction(
    'capital_in'::public.treasury_transaction_type,
    p_amount,
    p_notes,
    (select auth.uid()),
    null
  ) t;
end;
$$;

create or replace function public.create_treasury_withdrawal(
  p_amount numeric,
  p_notes text default null
)
returns table (
  id uuid,
  admin_id uuid,
  transaction_type public.treasury_transaction_type,
  amount numeric,
  running_balance numeric,
  notes text,
  source_financial_ledger_id uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_treasury_admin();
  return query
  select t.id, t.admin_id, t.transaction_type, t.amount, t.running_balance,
    t.notes, t.source_financial_ledger_id, t.created_at
  from private.append_treasury_transaction(
    'withdrawal_out'::public.treasury_transaction_type,
    p_amount,
    p_notes,
    (select auth.uid()),
    null
  ) t;
end;
$$;

revoke all on function public.create_treasury_deposit(numeric, text) from public, anon;
revoke all on function public.create_treasury_withdrawal(numeric, text) from public, anon;
grant execute on function public.create_treasury_deposit(numeric, text) to authenticated;
grant execute on function public.create_treasury_withdrawal(numeric, text) to authenticated;
