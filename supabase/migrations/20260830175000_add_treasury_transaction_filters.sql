-- Server-side filtering for the append-only treasury movement history.
drop function if exists public.get_treasury_transaction_page(integer, timestamptz, uuid);

create or replace function public.get_treasury_transaction_page(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_filter text default 'all'
)
returns table (
  id uuid,
  admin_id uuid,
  admin_name text,
  transaction_type public.treasury_transaction_type,
  amount numeric,
  running_balance numeric,
  notes text,
  source_financial_ledger_id uuid,
  created_at timestamptz,
  has_more boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view the treasury' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'p_limit must be between 1 and 50' using errcode = '22023';
  end if;
  if coalesce(p_filter, 'all') not in ('all', 'wages', 'cash') then
    raise exception 'p_filter must be all, wages, or cash' using errcode = '22023';
  end if;

  return query
  with eligible as (
    select
      t.id,
      t.admin_id,
      p.full_name as admin_name,
      t.transaction_type,
      t.amount,
      t.running_balance,
      t.notes,
      t.source_financial_ledger_id,
      t.created_at
    from public.treasury_transactions t
    left join public.profiles p on p.id = t.admin_id
    where (
      coalesce(p_filter, 'all') = 'all'
      or (p_filter = 'wages' and t.transaction_type = 'company_profit_in'::public.treasury_transaction_type)
      or (p_filter = 'cash' and t.transaction_type in ('capital_in'::public.treasury_transaction_type, 'withdrawal_out'::public.treasury_transaction_type))
    )
      and (
        p_before_created_at is null
        or (t.created_at, t.id) < (p_before_created_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    order by t.created_at desc, t.id desc
    limit p_limit + 1
  )
  select
    e.id,
    e.admin_id,
    e.admin_name,
    e.transaction_type,
    e.amount,
    e.running_balance,
    e.notes,
    e.source_financial_ledger_id,
    e.created_at,
    (select count(*) > p_limit from eligible)
  from eligible e
  order by e.created_at desc, e.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_treasury_transaction_page(integer, timestamptz, uuid, text) from public, anon;
grant execute on function public.get_treasury_transaction_page(integer, timestamptz, uuid, text) to authenticated;
