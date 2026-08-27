begin;

create or replace function public.update_office_expense(
  p_id uuid,
  p_title text,
  p_amount numeric,
  p_expense_date date,
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
    raise exception 'Current user is not allowed to update office expenses' using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'Expense id is required' using errcode = '22023';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Expense title must be between 1 and 160 characters' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount then
    raise exception 'Expense amount must be positive with at most two decimals' using errcode = '22023';
  end if;

  if p_expense_date is null then
    raise exception 'Expense date is required' using errcode = '22023';
  end if;

  return query
  update public.office_expenses as expense
  set
    title = btrim(p_title),
    amount = round(p_amount, 2),
    expense_date = p_expense_date,
    notes = nullif(btrim(p_notes), '')
  where expense.id = p_id
  returning
    expense.id,
    expense.title,
    expense.amount,
    expense.expense_date,
    expense.notes,
    expense.created_by,
    expense.created_at;

  if not found then
    raise exception 'Office expense was not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_office_expense(uuid, text, numeric, date, text)
  from public, anon;
grant execute on function public.update_office_expense(uuid, text, numeric, date, text)
  to authenticated;

commit;
