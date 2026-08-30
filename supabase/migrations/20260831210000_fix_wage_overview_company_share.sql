-- Company share is the 30% gross share less captain compensation for
-- medicine and false-order trips. Standard completed trips keep company_amount.

create or replace function private.get_wage_totals()
returns table (
  gross_total numeric,
  captain_net_total numeric,
  company_total numeric,
  settlement_total numeric,
  paid_total numeric,
  unpaid_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  return query
  with paid_by_ledger as (
    select financial_ledger_id, sum(captain_amount)::numeric as paid_amount
    from public.captain_payout_items
    group by financial_ledger_id
  ), ledger_balances as (
    select
      fl.gross_fee,
      fl.captain_amount,
      fl.company_amount,
      fl.settlement_amount,
      fl.source_status::text as source_status,
      o.order_kind,
      coalesce(paid.paid_amount, 0)::numeric as paid_amount
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
  )
  select
    coalesce(sum(gross_fee), 0)::numeric,
    coalesce(sum(captain_amount), 0)::numeric,
    coalesce(sum(private.company_financial_result_for_order(order_kind, source_status, gross_fee, captain_amount, company_amount)), 0)::numeric,
    coalesce(sum(settlement_amount), 0)::numeric,
    coalesce(sum(least(paid_amount, captain_amount)), 0)::numeric,
    coalesce(sum(greatest(captain_amount - paid_amount, 0)), 0)::numeric
  from ledger_balances;
end;
$$;

revoke all on function private.get_wage_totals() from public, anon;
grant execute on function private.get_wage_totals() to authenticated;

create or replace function private.get_captain_wage_period_summary(
  p_period text default 'daily',
  p_captain_id uuid default null,
  p_limit integer default 100,
  p_before_period_start date default null,
  p_before_captain_id uuid default null
)
returns table (
  period_start date,
  period_end date,
  captain_id uuid,
  captain_name text,
  order_count bigint,
  gross_total numeric,
  company_total numeric,
  captain_net_total numeric,
  paid_total numeric,
  unpaid_total numeric,
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
    raise exception 'Unsupported wage period' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100' using errcode = '22023';
  end if;
  if (p_before_period_start is null) <> (p_before_captain_id is null) then
    raise exception 'Pagination cursor is incomplete' using errcode = '22023';
  end if;

  return query
  with ledger_base as (
    select
      fl.id as financial_ledger_id,
      fl.captain_id,
      fl.gross_fee,
      fl.company_amount,
      fl.captain_amount,
      fl.settlement_amount,
      fl.source_status::text as source_status,
      o.order_kind,
      case
        when p_period = 'daily' then (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
        when p_period = 'weekly' then date_trunc('week', (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date)::date
        when p_period = 'monthly' then date_trunc('month', (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date)::date
        when p_period = 'annual' then date_trunc('year', (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date)::date
      end as period_start
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
      and (p_captain_id is null or fl.captain_id = p_captain_id)
  ), paid_by_ledger as (
    select financial_ledger_id, sum(captain_amount)::numeric as paid_amount
    from public.captain_payout_items
    group by financial_ledger_id
  ), grouped as (
    select
      lb.period_start,
      lb.captain_id,
      p.full_name as captain_name,
      count(*)::bigint as order_count,
      coalesce(sum(lb.gross_fee), 0)::numeric as gross_total,
      coalesce(sum(private.company_financial_result_for_order(lb.order_kind, lb.source_status, lb.gross_fee, lb.captain_amount, lb.company_amount)), 0)::numeric as company_total,
      coalesce(sum(lb.captain_amount), 0)::numeric as captain_net_total,
      coalesce(sum(least(coalesce(paid.paid_amount, 0), lb.captain_amount)), 0)::numeric as paid_total,
      coalesce(sum(greatest(lb.captain_amount - coalesce(paid.paid_amount, 0), 0)), 0)::numeric as unpaid_total,
      coalesce(sum(lb.settlement_amount), 0)::numeric as settlement_total
    from ledger_base lb
    join public.profiles p on p.id = lb.captain_id
    left join paid_by_ledger paid on paid.financial_ledger_id = lb.financial_ledger_id
    where p_before_period_start is null
       or (lb.period_start, lb.captain_id) < (p_before_period_start, p_before_captain_id)
    group by lb.period_start, lb.captain_id, p.full_name
  )
  select
    g.period_start,
    case
      when p_period = 'daily' then g.period_start
      when p_period = 'weekly' then g.period_start + 6
      when p_period = 'monthly' then (g.period_start + interval '1 month - 1 day')::date
      when p_period = 'annual' then (g.period_start + interval '1 year - 1 day')::date
    end,
    g.captain_id,
    coalesce(g.captain_name, 'كابتن بدون اسم'),
    g.order_count,
    g.gross_total,
    g.company_total,
    g.captain_net_total,
    g.paid_total,
    g.unpaid_total,
    g.settlement_total
  from grouped g
  order by g.period_start desc, g.captain_id desc
  limit p_limit;
end;
$$;

create or replace function public.get_captain_wage_period_summary(
  p_period text default 'daily',
  p_captain_id uuid default null,
  p_limit integer default 100,
  p_before_period_start date default null,
  p_before_captain_id uuid default null
)
returns table (
  period_start date,
  period_end date,
  captain_id uuid,
  captain_name text,
  order_count bigint,
  gross_total numeric,
  company_total numeric,
  captain_net_total numeric,
  paid_total numeric,
  unpaid_total numeric,
  settlement_total numeric
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_captain_wage_period_summary(
    p_period, p_captain_id, p_limit, p_before_period_start, p_before_captain_id
  )
$$;

revoke all on function private.get_captain_wage_period_summary(text, uuid, integer, date, uuid) from public, anon;
grant execute on function private.get_captain_wage_period_summary(text, uuid, integer, date, uuid) to authenticated;
revoke all on function public.get_captain_wage_period_summary(text, uuid, integer, date, uuid) from public, anon;
grant execute on function public.get_captain_wage_period_summary(text, uuid, integer, date, uuid) to authenticated;
