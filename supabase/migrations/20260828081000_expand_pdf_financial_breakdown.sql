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
      coalesce(sum(private.company_financial_result(
        fl.financial_treatment,
        fl.captain_amount,
        fl.company_amount
      )), 0)::numeric as company,
      coalesce(sum(fl.captain_amount), 0)::numeric as captain,
      coalesce(sum(case
        when fl.financial_treatment = 'false_order' then 0::numeric
        else fl.captain_amount
      end), 0)::numeric as captain_wages,
      coalesce(sum(case
        when fl.financial_treatment = 'false_order' then fl.captain_amount
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
      when fl.financial_treatment = 'false_order' then 0::numeric
      else fl.captain_amount
    end), 0)::numeric,
    coalesce(sum(case
      when fl.financial_treatment = 'false_order' then fl.captain_amount
      else 0::numeric
    end), 0)::numeric,
    coalesce(sum(private.company_financial_result(
      fl.financial_treatment,
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
