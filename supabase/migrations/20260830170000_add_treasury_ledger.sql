-- Delivery Tartous: append-only treasury ledger with serialized balance updates.
-- Company profit entries are created automatically when a completed order is
-- added to financial_ledger. Manual deposits and withdrawals use RPCs only.

insert into public.permissions (code, description)
values ('manage_treasury', 'Record company treasury deposits and withdrawals')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, is_allowed)
values ('admin'::public.app_role, 'manage_treasury', true)
on conflict (role, permission_code) do update
set is_allowed = excluded.is_allowed,
    updated_at = now();

create type public.treasury_transaction_type as enum (
  'company_profit_in',
  'capital_in',
  'withdrawal_out'
);

create table public.treasury_state (
  id boolean primary key default true check (id),
  current_balance numeric(14, 2) not null default 0 check (current_balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  transaction_type public.treasury_transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  running_balance numeric(14, 2) not null check (running_balance >= 0),
  notes text,
  source_financial_ledger_id uuid unique references public.financial_ledger(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint treasury_manual_actor_check check (
    source_financial_ledger_id is not null or admin_id is not null
  )
);

insert into public.treasury_state (id, current_balance)
values (true, 0)
on conflict (id) do nothing;

alter table public.treasury_state enable row level security;
alter table public.treasury_transactions enable row level security;
revoke all on table public.treasury_state from public, anon, authenticated;
revoke all on table public.treasury_transactions from public, anon, authenticated;

create index treasury_transactions_created_at_idx
  on public.treasury_transactions (created_at desc, id desc);
create index treasury_transactions_type_created_at_idx
  on public.treasury_transactions (transaction_type, created_at desc, id desc);

-- Backfill only completed-order company profit. This does not change existing
-- wage calculations; it establishes the opening balance for the new cash ledger.
with ordered_profits as (
  select
    fl.id,
    fl.company_amount,
    fl.created_at,
    sum(fl.company_amount) over (order by fl.created_at, fl.id)
      as balance_after
  from public.financial_ledger fl
  where fl.source_status = 'completed'::public.order_status
    and fl.company_amount > 0
)
insert into public.treasury_transactions (
  transaction_type,
  amount,
  running_balance,
  notes,
  source_financial_ledger_id,
  created_at
)
select
  'company_profit_in'::public.treasury_transaction_type,
  op.company_amount,
  op.balance_after,
  'ربح شركة من طلب مكتمل',
  op.id,
  op.created_at
from ordered_profits op
on conflict (source_financial_ledger_id) do nothing;

update public.treasury_state
set current_balance = coalesce(
  (select tt.running_balance
   from public.treasury_transactions tt
   order by tt.created_at desc, tt.id desc
   limit 1),
  0
), updated_at = now()
where id = true;

create or replace function private.append_treasury_transaction(
  p_transaction_type public.treasury_transaction_type,
  p_amount numeric,
  p_notes text default null,
  p_admin_id uuid default null,
  p_source_financial_ledger_id uuid default null
)
returns public.treasury_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.treasury_state;
  v_transaction public.treasury_transactions;
  v_amount numeric(14, 2) := round(coalesce(p_amount, 0), 2);
  v_balance numeric(14, 2);
begin
  if v_amount <= 0 then
    raise exception 'Treasury amount must be positive' using errcode = '22023';
  end if;

  if p_source_financial_ledger_id is null and p_admin_id is null then
    raise exception 'A manual treasury transaction requires an admin actor' using errcode = '42501';
  end if;

  select * into v_state
  from public.treasury_state
  where id = true
  for update;

  if not found then
    raise exception 'Treasury state is not initialized' using errcode = 'XX000';
  end if;

  if p_source_financial_ledger_id is not null then
    select * into v_transaction
    from public.treasury_transactions
    where source_financial_ledger_id = p_source_financial_ledger_id
    for update;
    if found then
      return v_transaction;
    end if;
  end if;

  v_balance := case
    when p_transaction_type = 'withdrawal_out'::public.treasury_transaction_type
      then v_state.current_balance - v_amount
    else v_state.current_balance + v_amount
  end;

  if v_balance < 0 then
    raise exception 'Treasury balance is insufficient for this withdrawal' using errcode = '22023';
  end if;

  update public.treasury_state
  set current_balance = v_balance,
      updated_at = now()
  where id = true;

  insert into public.treasury_transactions (
    admin_id,
    transaction_type,
    amount,
    running_balance,
    notes,
    source_financial_ledger_id
  )
  values (
    p_admin_id,
    p_transaction_type,
    v_amount,
    v_balance,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_source_financial_ledger_id
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;

create or replace function private.record_completed_order_profit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_status = 'completed'::public.order_status and new.company_amount > 0 then
    perform private.append_treasury_transaction(
      'company_profit_in'::public.treasury_transaction_type,
      new.company_amount,
      'ربح شركة من طلب مكتمل',
      null,
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger financial_ledger_treasury_after_insert
after insert on public.financial_ledger
for each row execute procedure private.record_completed_order_profit();

create or replace function public.get_treasury_overview()
returns table (
  current_balance numeric,
  company_profit_total numeric,
  capital_in_total numeric,
  withdrawal_total numeric,
  company_profit_today numeric,
  cash_flow_total numeric,
  transaction_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('view_finances') then
    raise exception 'Current user is not allowed to view the treasury' using errcode = '42501';
  end if;

  return query
  select
    s.current_balance,
    coalesce(sum(case when t.transaction_type = 'company_profit_in' then t.amount else 0 end), 0)::numeric,
    coalesce(sum(case when t.transaction_type = 'capital_in' then t.amount else 0 end), 0)::numeric,
    coalesce(sum(case when t.transaction_type = 'withdrawal_out' then t.amount else 0 end), 0)::numeric,
    (
      select coalesce(sum(fl.company_amount), 0)::numeric
      from public.financial_ledger fl
      join public.orders o on o.id = fl.order_id
      where fl.source_status = 'completed'::public.order_status
        and fl.company_amount > 0
        and (coalesce(o.completed_at, o.false_order_at) at time zone 'Asia/Damascus')::date
          = (now() at time zone 'Asia/Damascus')::date
    ) - coalesce((
      select sum(e.amount)::numeric
      from public.office_expenses e
      where e.expense_date = (now() at time zone 'Asia/Damascus')::date
    ), 0),
    coalesce(sum(case when t.transaction_type = 'capital_in' then t.amount else 0 end), 0)::numeric
      - coalesce(sum(case when t.transaction_type = 'withdrawal_out' then t.amount else 0 end), 0)::numeric,
    count(t.id)::bigint
  from public.treasury_state s
  left join public.treasury_transactions t on true
  where s.id = true
  group by s.current_balance;
end;
$$;

create or replace function public.get_treasury_transaction_page(
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
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
    where p_before_created_at is null
       or (t.created_at, t.id) < (p_before_created_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
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

create or replace function private.require_treasury_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('manage_treasury') then
    raise exception 'Only an admin can change the treasury' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.create_treasury_deposit(
  p_amount numeric,
  p_notes text default null
)
returns table (
  id uuid,
  admin_id uuid,
  transaction_type public.treasury_transaction_type,
  amount numeric,
  running_balance numeric,
  notes text,
  source_financial_ledger_id uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_treasury_admin();
  return query
  select t.id, t.admin_id, t.transaction_type, t.amount, t.running_balance,
    t.notes, t.source_financial_ledger_id, t.created_at
  from private.append_treasury_transaction(
    'capital_in'::public.treasury_transaction_type,
    p_amount,
    p_notes,
    (select auth.uid()),
    null
  ) t;
end;
$$;

create or replace function public.create_treasury_withdrawal(
  p_amount numeric,
  p_notes text default null
)
returns table (
  id uuid,
  admin_id uuid,
  transaction_type public.treasury_transaction_type,
  amount numeric,
  running_balance numeric,
  notes text,
  source_financial_ledger_id uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_treasury_admin();
  return query
  select t.id, t.admin_id, t.transaction_type, t.amount, t.running_balance,
    t.notes, t.source_financial_ledger_id, t.created_at
  from private.append_treasury_transaction(
    'withdrawal_out'::public.treasury_transaction_type,
    p_amount,
    p_notes,
    (select auth.uid()),
    null
  ) t;
end;
$$;

revoke all on function private.append_treasury_transaction(public.treasury_transaction_type, numeric, text, uuid, uuid) from public, anon;
revoke all on function private.record_completed_order_profit() from public, anon;
revoke all on function private.require_treasury_admin() from public, anon;
grant execute on function private.append_treasury_transaction(public.treasury_transaction_type, numeric, text, uuid, uuid) to authenticated;
grant execute on function private.require_treasury_admin() to authenticated;
revoke all on function public.get_treasury_overview() from public, anon;
revoke all on function public.get_treasury_transaction_page(integer, timestamptz, uuid) from public, anon;
revoke all on function public.create_treasury_deposit(numeric, text) from public, anon;
revoke all on function public.create_treasury_withdrawal(numeric, text) from public, anon;
grant execute on function public.get_treasury_overview() to authenticated;
grant execute on function public.get_treasury_transaction_page(integer, timestamptz, uuid) to authenticated;
grant execute on function public.create_treasury_deposit(numeric, text) to authenticated;
grant execute on function public.create_treasury_withdrawal(numeric, text) to authenticated;

comment on table public.treasury_transactions is 'Append-only cash movements for company treasury; corrections are recorded as opposite movements.';
comment on table public.treasury_state is 'Serialized current treasury balance used to prevent concurrent withdrawal races.';
