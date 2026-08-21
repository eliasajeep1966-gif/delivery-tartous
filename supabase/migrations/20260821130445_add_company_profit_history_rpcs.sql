-- Delivery Tartous: company finance history without per-captain or per-order fan-out.
-- No tables, data, payout logic, or 70/30 calculations are changed here.

create or replace function private.get_company_profit_history(
  p_start_date date default null,
  p_end_date date default null,
  p_limit_days integer default 90,
  p_before_day date default null
)
returns table (
  business_day date,
  order_count bigint,
  gross_total numeric,
  company_total numeric,
  captain_net_total numeric,
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

  if p_limit_days is null or p_limit_days < 1 or p_limit_days > 100 then
    raise exception 'p_limit_days must be between 1 and 100' using errcode = '22023';
  end if;

  if p_start_date is not null
     and p_end_date is not null
     and p_start_date > p_end_date then
    raise exception 'p_start_date must be on or before p_end_date' using errcode = '22023';
  end if;

  return query
  with ledger_days as (
    select
      (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date as business_day,
      fl.gross_fee,
      fl.company_amount,
      fl.captain_amount,
      fl.settlement_amount
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
  )
  select
    ld.business_day,
    count(*)::bigint,
    coalesce(sum(ld.gross_fee), 0)::numeric,
    coalesce(sum(ld.company_amount), 0)::numeric,
    coalesce(sum(ld.captain_amount), 0)::numeric,
    coalesce(sum(ld.settlement_amount), 0)::numeric
  from ledger_days ld
  where (p_start_date is null or ld.business_day >= p_start_date)
    and (p_end_date is null or ld.business_day <= p_end_date)
    and (p_before_day is null or ld.business_day < p_before_day)
  group by ld.business_day
  order by ld.business_day desc
  limit p_limit_days;
end;
$$;

create or replace function private.get_company_profit_day_details(
  p_business_day date,
  p_limit integer default 50,
  p_before_completed_at timestamptz default null,
  p_before_ledger_id uuid default null
)
returns table (
  financial_ledger_id uuid,
  order_id uuid,
  order_number bigint,
  source_status public.order_status,
  completed_at timestamptz,
  gross_fee numeric,
  company_amount numeric,
  captain_amount numeric,
  settlement_amount numeric,
  captain_id uuid,
  captain_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  if p_business_day is null then
    raise exception 'p_business_day is required' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100' using errcode = '22023';
  end if;

  if (p_before_completed_at is null) <> (p_before_ledger_id is null) then
    raise exception 'p_before_completed_at and p_before_ledger_id must be provided together' using errcode = '22023';
  end if;

  return query
  with day_details as (
    select
      fl.id as financial_ledger_id,
      fl.order_id,
      o.order_number,
      fl.source_status,
      coalesce(o.completed_at, o.false_order_at) as event_at,
      fl.gross_fee,
      fl.company_amount,
      fl.captain_amount,
      fl.settlement_amount,
      fl.captain_id,
      p.full_name as captain_name
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    left join public.profiles p on p.id = fl.captain_id
    where coalesce(o.completed_at, o.false_order_at) is not null
      and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date = p_business_day
  )
  select
    dd.financial_ledger_id,
    dd.order_id,
    dd.order_number,
    dd.source_status,
    dd.event_at,
    dd.gross_fee,
    dd.company_amount,
    dd.captain_amount,
    dd.settlement_amount,
    dd.captain_id,
    dd.captain_name
  from day_details dd
  where p_before_completed_at is null
     or (dd.event_at, dd.financial_ledger_id) < (p_before_completed_at, p_before_ledger_id)
  order by dd.event_at desc, dd.financial_ledger_id desc
  limit p_limit;
end;
$$;

create or replace function public.get_company_profit_history(
  p_start_date date default null,
  p_end_date date default null,
  p_limit_days integer default 90,
  p_before_day date default null
)
returns table (
  business_day date,
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
  from private.get_company_profit_history(
    p_start_date,
    p_end_date,
    p_limit_days,
    p_before_day
  )
$$;

create or replace function public.get_company_profit_day_details(
  p_business_day date,
  p_limit integer default 50,
  p_before_completed_at timestamptz default null,
  p_before_ledger_id uuid default null
)
returns table (
  financial_ledger_id uuid,
  order_id uuid,
  order_number bigint,
  source_status public.order_status,
  completed_at timestamptz,
  gross_fee numeric,
  company_amount numeric,
  captain_amount numeric,
  settlement_amount numeric,
  captain_id uuid,
  captain_name text
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.get_company_profit_day_details(
    p_business_day,
    p_limit,
    p_before_completed_at,
    p_before_ledger_id
  )
$$;

alter function private.get_company_profit_history(date, date, integer, date) owner to postgres;
alter function private.get_company_profit_day_details(date, integer, timestamptz, uuid) owner to postgres;
alter function public.get_company_profit_history(date, date, integer, date) owner to postgres;
alter function public.get_company_profit_day_details(date, integer, timestamptz, uuid) owner to postgres;

revoke all on function private.get_company_profit_history(date, date, integer, date)
  from public, anon, authenticated;
revoke all on function private.get_company_profit_day_details(date, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function private.get_company_profit_history(date, date, integer, date)
  to authenticated;
grant execute on function private.get_company_profit_day_details(date, integer, timestamptz, uuid)
  to authenticated;

revoke all on function public.get_company_profit_history(date, date, integer, date)
  from public, anon, authenticated;
revoke all on function public.get_company_profit_day_details(date, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_company_profit_history(date, date, integer, date)
  to authenticated;
grant execute on function public.get_company_profit_day_details(date, integer, timestamptz, uuid)
  to authenticated;
