create or replace function public.get_office_expense_day_page(
  p_start_date date default null,
  p_end_date date default null,
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
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view office expenses' using errcode = '42501';
  end if;

  if p_day_limit is null or p_day_limit < 1 or p_day_limit > 5 then
    raise exception 'p_day_limit must be between 1 and 5' using errcode = '22023';
  end if;

  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'p_start_date must be on or before p_end_date' using errcode = '22023';
  end if;

  return query
  with eligible_days as (
    select distinct e.expense_date
    from public.office_expenses e
    where (p_start_date is null or e.expense_date >= p_start_date)
      and (p_end_date is null or e.expense_date <= p_end_date)
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

revoke all on function public.get_office_expense_day_page(date, date, date, integer) from public, anon;
grant execute on function public.get_office_expense_day_page(date, date, date, integer) to authenticated;
