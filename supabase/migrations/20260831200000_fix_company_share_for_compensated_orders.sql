
create or replace function private.company_financial_result_for_order(
  p_order_kind text,
  p_source_status text,
  p_gross_fee numeric,
  p_captain_amount numeric,
  p_company_amount numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_source_status = 'false_order' or p_order_kind = 'medicine'
      then round(coalesce(p_gross_fee, 0) * 0.30, 2) - coalesce(p_captain_amount, 0)
    else coalesce(p_company_amount, 0)
  end
$$;


-- Medicine and false-order trips are free for the customer, while the company
-- funds the captain's 70% wage. Treat that wage as a company cost in every
-- company-profit calculation. The existing settlement_total response field is
-- retained for client compatibility but now means captain compensation total.

create or replace function private.company_financial_result(
  p_financial_treatment text,
  p_captain_amount numeric,
  p_company_amount numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_financial_treatment = 'false_order' then -coalesce(p_captain_amount, 0)
    else coalesce(p_company_amount, 0)
  end
$$;

create or replace function private.get_company_profit_period_history(
  p_period text default 'daily',
  p_limit integer default 30,
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
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  if p_period is null or p_period not in ('daily', 'weekly', 'monthly', 'annual') then
    raise exception 'p_period must be one of: daily, weekly, monthly, annual' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with ledger_days as (
    select
      (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date as business_day,
      fl.gross_fee,
      private.company_financial_result_for_order(
        o.order_kind,
        fl.source_status::text,
        fl.gross_fee,
        fl.captain_amount,
        fl.company_amount
      ) as company_result,
      fl.captain_amount,
      case
        when fl.source_status = 'false_order' or o.order_kind = 'medicine' then fl.captain_amount
        else 0::numeric
      end as captain_compensation_amount
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
  ),
  periodized_ledger as (
    select
      case p_period
        when 'daily' then ld.business_day
        when 'weekly' then private.saturday_week_start(ld.business_day)
        when 'monthly' then date_trunc('month', ld.business_day::timestamp)::date
        when 'annual' then date_trunc('year', ld.business_day::timestamp)::date
      end as period_start,
      ld.gross_fee,
      ld.company_result,
      ld.captain_amount,
      ld.captain_compensation_amount
    from ledger_days ld
  )
  select
    pl.period_start,
    case p_period
      when 'daily' then pl.period_start
      when 'weekly' then pl.period_start + 6
      when 'monthly' then (pl.period_start + interval '1 month - 1 day')::date
      when 'annual' then (pl.period_start + interval '1 year - 1 day')::date
    end as period_end,
    count(*)::bigint,
    coalesce(sum(pl.gross_fee), 0)::numeric,
    coalesce(sum(pl.company_result), 0)::numeric,
    coalesce(sum(pl.captain_amount), 0)::numeric,
    coalesce(sum(pl.captain_compensation_amount), 0)::numeric
  from periodized_ledger pl
  where p_before_period_start is null
     or pl.period_start < p_before_period_start
  group by pl.period_start
  order by pl.period_start desc
  limit p_limit;
end;
$$;

create or replace function public.get_company_expense_period_summary(
  p_period text default 'daily',
  p_limit integer default 100,
  p_before_period_start date default null
)
returns table (
  period_start date,
  period_end date,
  company_gross_total numeric,
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

  if p_period is null or p_period not in ('daily', 'weekly', 'monthly', 'annual') then
    raise exception 'p_period must be daily, weekly, monthly, or annual' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100' using errcode = '22023';
  end if;

  return query
  with company_days as (
    select
      (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date as business_day,
      private.company_financial_result_for_order(
        o.order_kind,
        fl.source_status::text,
        fl.gross_fee,
        fl.captain_amount,
        fl.company_amount
      ) as amount
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
  ),
  entries as (
    select cd.business_day, cd.amount as company_amount, 0::numeric as expense_amount
    from company_days cd
    union all
    select e.expense_date, 0::numeric, e.amount
    from public.office_expenses e
  ),
  grouped as (
    select
      case p_period
        when 'daily' then business_day
        when 'weekly' then private.saturday_week_start(business_day)
        when 'monthly' then date_trunc('month', business_day::timestamp)::date
        when 'annual' then date_trunc('year', business_day::timestamp)::date
      end as period_start,
      sum(company_amount)::numeric as company_amount,
      sum(expense_amount)::numeric as expense_amount
    from entries
    group by 1
  )
  select
    g.period_start,
    case p_period
      when 'daily' then g.period_start
      when 'weekly' then g.period_start + 6
      when 'monthly' then (g.period_start + interval '1 month - 1 day')::date
      when 'annual' then (g.period_start + interval '1 year - 1 day')::date
    end,
    coalesce(g.company_amount, 0),
    coalesce(g.expense_amount, 0),
    coalesce(g.company_amount, 0) - coalesce(g.expense_amount, 0)
  from grouped g
  where p_before_period_start is null or g.period_start < p_before_period_start
  order by g.period_start desc
  limit p_limit;
end;
$$;

drop function if exists public.get_company_report_range_summary(date, date);
drop function if exists private.get_company_report_range_summary(text, integer, date);

create or replace function public.get_company_report_range_summary(
  p_start_date date default null,
  p_end_date date default null
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

  if (p_start_date is null) <> (p_end_date is null) then
    raise exception 'p_start_date and p_end_date must be provided together' using errcode = '22023';
  end if;

  if p_start_date is not null and p_start_date > p_end_date then
    raise exception 'p_start_date must be on or before p_end_date' using errcode = '22023';
  end if;

  return query
  with ledger_totals as (
    select
      count(*)::bigint as orders,
      coalesce(sum(fl.gross_fee), 0)::numeric as gross,
      coalesce(sum(private.company_financial_result_for_order(
        o.order_kind,
        fl.source_status::text,
        fl.gross_fee,
        fl.captain_amount,
        fl.company_amount
      )), 0)::numeric as company,
      coalesce(sum(fl.captain_amount), 0)::numeric as captain
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
      and (
        p_start_date is null
        or (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
          between p_start_date and p_end_date
      )
  ),
  expense_totals as (
    select coalesce(sum(e.amount), 0)::numeric as expenses
    from public.office_expenses e
    where p_start_date is null
       or e.expense_date between p_start_date and p_end_date
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


-- Expand concise PDF summaries with explicit captain compensation and company-result fields.
-- Existing fields are preserved for client compatibility; new fields make the finance meaning clear.

-- PostgreSQL requires recreating a function when its returned table gains columns.
drop function if exists public.get_company_report_range_summary(date, date);
drop function if exists public.get_captain_report_range_summary(uuid, date, date);

create function public.get_company_report_range_summary(
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  period_start date,
  period_end date,
  order_count bigint,
  gross_total numeric,
  company_total numeric,
  captain_net_total numeric,
  captain_wage_total numeric,
  captain_compensation_total numeric,
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

  if (p_start_date is null) <> (p_end_date is null) then
    raise exception 'p_start_date and p_end_date must be provided together' using errcode = '22023';
  end if;

  if p_start_date is not null and p_start_date > p_end_date then
    raise exception 'p_start_date must be on or before p_end_date' using errcode = '22023';
  end if;

  return query
  with ledger_totals as (
    select
      count(*)::bigint as orders,
      coalesce(sum(fl.gross_fee), 0)::numeric as gross,
      coalesce(sum(private.company_financial_result_for_order(
        o.order_kind,
        fl.source_status::text,
        fl.gross_fee,
        fl.captain_amount,
        fl.company_amount
      )), 0)::numeric as company,
      coalesce(sum(fl.captain_amount), 0)::numeric as captain,
      coalesce(sum(case
        when fl.source_status = 'false_order' or o.order_kind = 'medicine' then 0::numeric
        else fl.captain_amount
      end), 0)::numeric as captain_wages,
      coalesce(sum(case
        when fl.source_status = 'false_order' or o.order_kind = 'medicine' then fl.captain_amount
        else 0::numeric
      end), 0)::numeric as captain_compensations
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    where coalesce(o.completed_at, o.false_order_at) is not null
      and (
        p_start_date is null
        or (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
          between p_start_date and p_end_date
      )
  ),
  expense_totals as (
    select coalesce(sum(e.amount), 0)::numeric as expenses
    from public.office_expenses e
    where p_start_date is null
       or e.expense_date between p_start_date and p_end_date
  )
  select
    p_start_date,
    p_end_date,
    lt.orders,
    lt.gross,
    lt.company,
    lt.captain,
    lt.captain_wages,
    lt.captain_compensations,
    et.expenses,
    (lt.company - et.expenses)::numeric
  from ledger_totals lt
  cross join expense_totals et;
end;
$$;

create function public.get_captain_report_range_summary(
  p_captain_id uuid,
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  captain_id uuid,
  captain_name text,
  period_start date,
  period_end date,
  order_count bigint,
  gross_total numeric,
  captain_total numeric,
  company_total numeric,
  captain_wage_total numeric,
  captain_compensation_total numeric,
  company_result_total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_captain_name text;
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view finances' using errcode = '42501';
  end if;

  if p_captain_id is null then
    raise exception 'p_captain_id is required' using errcode = '22023';
  end if;

  if (p_start_date is null) <> (p_end_date is null) then
    raise exception 'p_start_date and p_end_date must be provided together' using errcode = '22023';
  end if;

  if p_start_date is not null and p_start_date > p_end_date then
    raise exception 'p_start_date must be on or before p_end_date' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'كابتن بدون اسم')
    into v_captain_name
  from public.profiles p
  where p.id = p_captain_id
    and p.role = 'captain'::public.app_role;

  if v_captain_name is null then
    raise exception 'Captain not found' using errcode = '22023';
  end if;

  return query
  select
    p_captain_id,
    v_captain_name,
    p_start_date,
    p_end_date,
    count(*)::bigint,
    coalesce(sum(fl.gross_fee), 0)::numeric,
    coalesce(sum(fl.captain_amount), 0)::numeric,
    coalesce(sum(fl.company_amount), 0)::numeric,
    coalesce(sum(case
      when fl.source_status = 'false_order' or o.order_kind = 'medicine' then 0::numeric
      else fl.captain_amount
    end), 0)::numeric,
    coalesce(sum(case
      when fl.source_status = 'false_order' or o.order_kind = 'medicine' then fl.captain_amount
      else 0::numeric
    end), 0)::numeric,
    coalesce(sum(private.company_financial_result_for_order(
        o.order_kind,
        fl.source_status::text,
        fl.gross_fee,
        fl.captain_amount,
        fl.company_amount
      )), 0)::numeric
  from public.financial_ledger fl
  join public.orders o on o.id = fl.order_id
  where fl.captain_id = p_captain_id
    and coalesce(o.completed_at, o.false_order_at) is not null
    and (
      p_start_date is null
      or (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
        between p_start_date and p_end_date
    );
end;
$$;

alter function public.get_company_report_range_summary(date, date) owner to postgres;
alter function public.get_captain_report_range_summary(uuid, date, date) owner to postgres;
revoke all on function public.get_company_report_range_summary(date, date) from public, anon, authenticated;
revoke all on function public.get_captain_report_range_summary(uuid, date, date) from public, anon, authenticated;
grant execute on function public.get_company_report_range_summary(date, date) to authenticated;
grant execute on function public.get_captain_report_range_summary(uuid, date, date) to authenticated;


-- Delivery Tartous: paginated admin detail ledger for one captain.
-- Returns a server-filtered page together with complete finance totals for the selected Damascus period.

create or replace function private.get_captain_wage_details_page(
  p_captain_id uuid,
  p_period text default 'daily',
  p_limit integer default 10,
  p_offset integer default 0,
  p_custom_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := lower(coalesce(p_period, 'daily'));
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_today date := timezone('Asia/Damascus', now())::date;
  v_target_date date := coalesce(p_custom_date, timezone('Asia/Damascus', now())::date);
  v_result jsonb;
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view captain wage details' using errcode = '42501';
  end if;

  if p_captain_id is null then
    raise exception 'Captain is required' using errcode = '22023';
  end if;

  if v_period not in ('daily', 'weekly', 'monthly', 'annual') then
    raise exception 'Unsupported wage period: %', v_period using errcode = '22023';
  end if;

  if p_custom_date is not null and p_custom_date > v_today then
    raise exception 'Custom wage date cannot be in the future' using errcode = '22023';
  end if;

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
  ), base as (
    select
      fl.id as financial_ledger_id,
      fl.order_id,
      o.order_number,
      fl.source_status,
      fl.gross_fee,
      fl.captain_amount,
      fl.company_amount,
      fl.settlement_amount,
      o.order_kind,
      coalesce(o.completed_at, o.false_order_at) as completed_at,
      coalesce(paid.paid_amount, 0)::numeric as paid_amount,
      greatest(fl.captain_amount - coalesce(paid.paid_amount, 0), 0)::numeric as unpaid_amount,
      coalesce(paid.paid_amount, 0) >= fl.captain_amount as is_fully_paid,
      latest.payout_id as latest_payout_id,
      latest.paid_at as latest_paid_at,
      fl.created_at
    from public.financial_ledger fl
    join public.orders o on o.id = fl.order_id
    left join paid_by_ledger paid on paid.financial_ledger_id = fl.id
    left join latest_allocation latest on latest.financial_ledger_id = fl.id
    where fl.captain_id = p_captain_id
      and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date <= v_today
      and case
        when p_custom_date is not null then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date = v_target_date
        when v_period = 'daily' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date = v_today
        when v_period = 'weekly' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date >= v_today - 6
        when v_period = 'monthly' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date >= date_trunc('month', v_today)::date
        when v_period = 'annual' then
          (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date >= date_trunc('year', v_today)::date
      end
  ), totals as (
    select
      count(*)::integer as total,
      coalesce(sum(gross_fee), 0)::numeric as gross,
      coalesce(sum(captain_amount), 0)::numeric as captain,
      coalesce(sum(case
        when source_status = 'false_order' or order_kind = 'medicine'
          then round(gross_fee * 0.30, 2) - captain_amount
        else company_amount
      end), 0)::numeric as company,
      coalesce(sum(settlement_amount), 0)::numeric as settlement,
      coalesce(sum(paid_amount), 0)::numeric as paid,
      coalesce(sum(unpaid_amount), 0)::numeric as unpaid
    from base
  ), page_rows as (
    select *
    from base
    order by completed_at desc, created_at desc
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'total', totals.total,
    'totals', jsonb_build_object(
      'gross', totals.gross,
      'captain', totals.captain,
      'company', totals.company,
      'settlement', totals.settlement,
      'paid', totals.paid,
      'unpaid', totals.unpaid
    ),
    'rows', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'financial_ledger_id', page_rows.financial_ledger_id,
            'order_id', page_rows.order_id,
            'order_number', page_rows.order_number,
            'source_status', page_rows.source_status,
            'gross_fee', page_rows.gross_fee,
            'captain_amount', page_rows.captain_amount,
            'company_amount', case
              when page_rows.source_status = 'false_order' or page_rows.order_kind = 'medicine'
                then round(page_rows.gross_fee * 0.30, 2) - page_rows.captain_amount
              else page_rows.company_amount
            end,
            'settlement_amount', page_rows.settlement_amount,
            'completed_at', page_rows.completed_at,
            'paid_amount', page_rows.paid_amount,
            'unpaid_amount', page_rows.unpaid_amount,
            'is_fully_paid', page_rows.is_fully_paid,
            'latest_payout_id', page_rows.latest_payout_id,
            'latest_paid_at', page_rows.latest_paid_at
          )
          order by page_rows.completed_at desc, page_rows.created_at desc
        )
        from page_rows
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from totals;

  return v_result;
end;
$$;

create or replace function public.get_captain_wage_details_page(
  p_captain_id uuid,
  p_period text default 'daily',
  p_limit integer default 10,
  p_offset integer default 0,
  p_custom_date date default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_captain_wage_details_page(
    p_captain_id,
    p_period,
    p_limit,
    p_offset,
    p_custom_date
  )
$$;

revoke all on function private.get_captain_wage_details_page(uuid, text, integer, integer, date)
  from public, anon;
grant execute on function private.get_captain_wage_details_page(uuid, text, integer, integer, date)
  to authenticated;
revoke all on function public.get_captain_wage_details_page(uuid, text, integer, integer, date)
  from public, anon;
grant execute on function public.get_captain_wage_details_page(uuid, text, integer, integer, date)
  to authenticated;
