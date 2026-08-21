-- Delivery Tartous: qualify the payout-ledger column to avoid PL/pgSQL output-column ambiguity.
-- This changes only name resolution; business logic and permissions remain unchanged.

create or replace function private.get_captain_wage_details_v2(p_captain_id uuid)
returns table (
  financial_ledger_id uuid,
  order_id uuid,
  order_number bigint,
  source_status public.order_status,
  gross_fee numeric,
  captain_amount numeric,
  company_amount numeric,
  settlement_amount numeric,
  completed_at timestamptz,
  paid_amount numeric,
  unpaid_amount numeric,
  is_fully_paid boolean,
  latest_payout_id uuid,
  latest_paid_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    private.has_permission('view_finances')
    or (
      private.current_user_role() = 'captain'::public.app_role
      and p_captain_id = (select auth.uid())
    )
  ) then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  return query
  with paid_by_ledger as (
    select
      cpi.financial_ledger_id,
      sum(cpi.captain_amount)::numeric as paid_amount
    from public.captain_payout_items cpi
    group by cpi.financial_ledger_id
  ), latest_allocation as (
    select distinct on (cpi.financial_ledger_id)
      cpi.financial_ledger_id,
      cpi.payout_id,
      cp.paid_at
    from public.captain_payout_items cpi
    join public.captain_payouts cp on cp.id = cpi.payout_id
    order by cpi.financial_ledger_id, cp.paid_at desc, cpi.payout_id desc
  )
  select
    fl.id,
    fl.order_id,
    o.order_number,
    fl.source_status,
    fl.gross_fee,
    fl.captain_amount,
    fl.company_amount,
    fl.settlement_amount,
    coalesce(o.completed_at, o.false_order_at),
    coalesce(paid.paid_amount, 0)::numeric,
    greatest(fl.captain_amount - coalesce(paid.paid_amount, 0), 0)::numeric,
    coalesce(paid.paid_amount, 0) >= fl.captain_amount,
    latest.payout_id,
    latest.paid_at
  from public.financial_ledger fl
  join public.orders o on o.id = fl.order_id
  left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
  left join latest_allocation latest on latest.financial_ledger_id = fl.id
  where fl.captain_id = p_captain_id
  order by coalesce(o.completed_at, o.false_order_at) desc, fl.created_at desc;
end;
$$;

revoke all on function private.get_captain_wage_details_v2(uuid) from public, anon, authenticated;
grant execute on function private.get_captain_wage_details_v2(uuid) to authenticated;
grant execute on function private.get_captain_wage_details_v2(uuid) to service_role;
