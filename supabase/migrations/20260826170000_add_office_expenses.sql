create table if not exists public.office_expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists office_expenses_expense_date_idx
  on public.office_expenses (expense_date desc, id desc);

alter table public.office_expenses enable row level security;
revoke all on table public.office_expenses from anon, authenticated;
grant usage on schema public to authenticated;

create or replace function public.create_office_expense(
  p_title text,
  p_amount numeric,
  p_expense_date date default current_date,
  p_notes text default null
)
returns table (
  id uuid,
  title text,
  amount numeric,
  expense_date date,
  notes text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to manage office expenses' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Expense title must be between 1 and 160 characters' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount then
    raise exception 'Expense amount must be positive with at most two decimals' using errcode = '22023';
  end if;
  return query
  insert into public.office_expenses (title, amount, expense_date, notes, created_by)
  values (btrim(p_title), round(p_amount, 2), coalesce(p_expense_date, current_date), nullif(btrim(p_notes), ''), (select auth.uid()))
  returning office_expenses.id, office_expenses.title, office_expenses.amount,
    office_expenses.expense_date, office_expenses.notes, office_expenses.created_by,
    office_expenses.created_at;
end;
$$;

create or replace function public.list_office_expenses(
  p_limit integer default 100,
  p_before_date date default null,
  p_before_id uuid default null
)
returns table (
  id uuid,
  title text,
  amount numeric,
  expense_date date,
  notes text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view office expenses' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit must be between 1 and 200' using errcode = '22023';
  end if;
  return query
  select e.id, e.title, e.amount, e.expense_date, e.notes, e.created_by, e.created_at
  from public.office_expenses e
  where p_before_date is null
     or e.expense_date < p_before_date
     or (e.expense_date = p_before_date and p_before_id is not null and e.id < p_before_id)
  order by e.expense_date desc, e.id desc
  limit p_limit;
end;
$$;

create or replace function public.delete_office_expense(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to delete office expenses' using errcode = '42501';
  end if;
  delete from public.office_expenses where id = p_id;
  return found;
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
      fl.company_amount as amount
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
        when 'weekly' then date_trunc('week', business_day::timestamp)::date
        when 'monthly' then date_trunc('month', business_day::timestamp)::date
        when 'annual' then date_trunc('year', business_day::timestamp)::date
      end as period_start,
      sum(company_amount)::numeric as company_amount,
      sum(expense_amount)::numeric as expense_amount
    from entries
    group by 1
  )
  select g.period_start,
    case p_period
      when 'daily' then g.period_start
      when 'weekly' then g.period_start + 6
      when 'monthly' then (g.period_start + interval '1 month - 1 day')::date
      when 'annual' then (g.period_start + interval '1 year - 1 day')::date
    end,
    coalesce(g.company_amount, 0), coalesce(g.expense_amount, 0),
    coalesce(g.company_amount, 0) - coalesce(g.expense_amount, 0)
  from grouped g
  where p_before_period_start is null or g.period_start < p_before_period_start
  order by g.period_start desc
  limit p_limit;
end;
$$;

revoke all on function public.create_office_expense(text, numeric, date, text) from public, anon;
grant execute on function public.create_office_expense(text, numeric, date, text) to authenticated;
revoke all on function public.list_office_expenses(integer, date, uuid) from public, anon;
grant execute on function public.list_office_expenses(integer, date, uuid) to authenticated;
revoke all on function public.delete_office_expense(uuid) from public, anon;
grant execute on function public.delete_office_expense(uuid) to authenticated;
revoke all on function public.get_company_expense_period_summary(text, integer, date) from public, anon;
grant execute on function public.get_company_expense_period_summary(text, integer, date) to authenticated;
