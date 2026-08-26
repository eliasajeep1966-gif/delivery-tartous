create or replace function public.get_office_expense_day_page(
  p_filter text default 'all',
  p_custom_date date default null,
  p_before_day date default null,
  p_day_limit integer default 5
)
returns table (
  expense_date date,
  expense_total numeric,
  expense_count integer,
  expenses jsonb,
  has_more boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Damascus')::date;
  v_start_date date := null;
  v_end_date date := null;
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view office expenses' using errcode = '42501';
  end if;

  if p_filter not in ('all', 'today', 'week', 'month', 'custom') then
    raise exception 'Unsupported office expense filter' using errcode = '22023';
  end if;

  if p_day_limit is null or p_day_limit < 1 or p_day_limit > 5 then
    raise exception 'p_day_limit must be between 1 and 5' using errcode = '22023';
  end if;

  if p_filter = 'today' then
    v_start_date := v_today;
    v_end_date := v_today;
  elsif p_filter = 'week' then
    v_start_date := date_trunc('week', v_today)::date;
    v_end_date := v_today;
  elsif p_filter = 'month' then
    v_start_date := date_trunc('month', v_today)::date;
    v_end_date := v_today;
  elsif p_filter = 'custom' then
    if p_custom_date is null then
      raise exception 'p_custom_date is required for the custom filter' using errcode = '22023';
    end if;
    v_start_date := p_custom_date;
    v_end_date := p_custom_date;
  end if;

  return query
  with eligible_days as (
    select distinct e.expense_date
    from public.office_expenses e
    where (v_start_date is null or e.expense_date >= v_start_date)
      and (v_end_date is null or e.expense_date <= v_end_date)
      and (p_before_day is null or e.expense_date < p_before_day)
    order by e.expense_date desc
    limit p_day_limit + 1
  ),
  page_days as (
    select expense_date
    from eligible_days
    order by expense_date desc
    limit p_day_limit
  ),
  page_meta as (
    select count(*) > p_day_limit as has_more
    from eligible_days
  )
  select
    d.expense_date,
    coalesce(sum(e.amount), 0)::numeric as expense_total,
    count(e.id)::integer as expense_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'amount', e.amount,
          'notes', e.notes,
          'created_by', e.created_by,
          'created_at', e.created_at
        )
        order by e.created_at desc, e.id desc
      ),
      '[]'::jsonb
    ) as expenses,
    m.has_more
  from page_days d
  join public.office_expenses e on e.expense_date = d.expense_date
  cross join page_meta m
  group by d.expense_date, m.has_more
  order by d.expense_date desc;
end;
$$;

revoke all on function public.get_office_expense_day_page(text, date, date, integer) from public, anon;
grant execute on function public.get_office_expense_day_page(text, date, date, integer) to authenticated;
