-- Delivery Tartous: captain wage statements, recorded payouts, and supervisor custody/finance access.
-- This migration adds new tables and functions only; historical migrations remain unchanged.

insert into public.permissions (code, description) values
  ('manage_captain_payouts', 'Record captain wage payouts and review captain wage statements')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, is_allowed) values
  ('admin'::public.app_role, 'manage_captain_custody', true),
  ('supervisor'::public.app_role, 'manage_captain_custody', true),
  ('admin'::public.app_role, 'view_finances', true),
  ('supervisor'::public.app_role, 'view_finances', true),
  ('admin'::public.app_role, 'manage_captain_payouts', true),
  ('supervisor'::public.app_role, 'manage_captain_payouts', true)
on conflict (role, permission_code) do update
  set is_allowed = excluded.is_allowed,
      updated_at = now();

-- Supervisors with custody permission can read current and historical captain custody records.
drop policy if exists "captain_custody_select_own_or_authorized_admin" on public.captain_custody;
create policy "captain_custody_select_own_or_authorized_staff"
on public.captain_custody
for select
to authenticated
using (
  captain_id = (select auth.uid())
  or private.has_permission('manage_captain_custody')
);

-- Supervisors can see custody assigned to a pending captain while the account is waiting for activation.
drop policy if exists "pending_captain_custody_select_active_admin_only" on public.pending_captain_custody;
create policy "pending_captain_custody_select_authorized_staff"
on public.pending_captain_custody
for select
to authenticated
using (private.has_permission('manage_captain_custody'));

-- A supervisor who can manage captains and custody may add custody text during captain Pending creation.
create or replace function private.create_pending_account(
  p_email text,
  p_full_name text,
  p_role public.app_role,
  p_custody_items_text text default null
)
returns public.pending_account_activations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_items text[];
  v_pending public.pending_account_activations;
  v_item text;
  v_is_admin boolean := private.has_permission('manage_users');
  v_can_manage_captains boolean := private.has_permission('manage_captains');
  v_can_manage_custody boolean := private.has_permission('manage_captain_custody');
begin
  if not v_is_admin and not v_can_manage_captains then
    raise exception 'Current user is not allowed to create pending accounts' using errcode = '42501';
  end if;

  if not v_is_admin and p_role <> 'captain'::public.app_role then
    raise exception 'Supervisors can only create captain accounts' using errcode = '42501';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 320 then
    raise exception 'A valid normalized email is required' using errcode = '22023';
  end if;

  if v_full_name is not null and length(v_full_name) > 120 then
    raise exception 'Full name must be 120 characters or fewer' using errcode = '22023';
  end if;

  select coalesce(array_agg(item_name), '{}'::text[])
  into v_items
  from (
    select nullif(btrim(raw_item), '') as item_name
    from unnest(regexp_split_to_array(coalesce(p_custody_items_text, ''), E'\r?\n')) as raw_item
  ) parsed
  where item_name is not null;

  if coalesce(cardinality(v_items), 0) > 20 then
    raise exception 'Maximum 20 custody items are allowed' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_items) as item where length(item) > 160) then
    raise exception 'Each custody item must be 160 characters or fewer' using errcode = '22023';
  end if;

  if p_role <> 'captain'::public.app_role and coalesce(cardinality(v_items), 0) > 0 then
    raise exception 'Custody items can only be assigned to a captain' using errcode = '22023';
  end if;

  if coalesce(cardinality(v_items), 0) > 0 and not v_can_manage_custody then
    raise exception 'Current user is not allowed to assign captain custody' using errcode = '42501';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'An Auth user already exists for this email' using errcode = '23505';
  end if;

  if exists (select 1 from public.pending_account_activations where email = v_email) then
    raise exception 'A pending account record already exists for this email' using errcode = '23505';
  end if;

  insert into public.pending_account_activations (
    email,
    full_name,
    role,
    created_by_user_id
  )
  values (
    v_email,
    v_full_name,
    p_role,
    (select auth.uid())
  )
  returning * into v_pending;

  foreach v_item in array v_items loop
    insert into public.pending_captain_custody (pending_account_id, item_name)
    values (v_pending.id, v_item);
  end loop;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'pending_account_created',
    'pending_account_activation',
    v_pending.id,
    jsonb_build_object(
      'email', v_pending.email,
      'role', v_pending.role::text,
      'created_by_role', private.current_user_role()::text,
      'custody_item_count', coalesce(cardinality(v_items), 0)
    )
  );

  return v_pending;
end;
$$;

create table public.captain_payouts (
  id uuid primary key default gen_random_uuid(),
  captain_id uuid not null references public.profiles(id) on delete restrict,
  total_amount numeric(12, 2) not null check (total_amount > 0),
  paid_by_user_id uuid not null references public.profiles(id) on delete restrict,
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  constraint captain_payouts_notes_max_length check (notes is null or length(btrim(notes)) <= 500)
);

create table public.captain_payout_items (
  payout_id uuid not null references public.captain_payouts(id) on delete restrict,
  financial_ledger_id uuid not null unique references public.financial_ledger(id) on delete restrict,
  captain_amount numeric(12, 2) not null check (captain_amount > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, financial_ledger_id)
);

create index captain_payouts_captain_paid_at_idx
  on public.captain_payouts (captain_id, paid_at desc);

create index captain_payout_items_ledger_idx
  on public.captain_payout_items (financial_ledger_id);

alter table public.captain_payouts enable row level security;
alter table public.captain_payout_items enable row level security;

revoke all on table public.captain_payouts, public.captain_payout_items
  from anon, authenticated;
grant select on table public.captain_payouts, public.captain_payout_items to authenticated;

create policy "captain_payouts_select_finance_staff"
on public.captain_payouts
for select
to authenticated
using (private.has_permission('view_finances'));

create policy "captain_payout_items_select_finance_staff"
on public.captain_payout_items
for select
to authenticated
using (private.has_permission('view_finances'));

create or replace function private.create_captain_payout(
  p_captain_id uuid,
  p_financial_ledger_ids uuid[],
  p_notes text default null
)
returns public.captain_payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout public.captain_payouts;
  v_ledger public.financial_ledger;
  v_total numeric(12, 2) := 0;
  v_selected_count integer := 0;
  v_unique_count integer := 0;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if not private.has_permission('manage_captain_payouts') then
    raise exception 'Current user is not allowed to record captain payouts' using errcode = '42501';
  end if;

  if p_captain_id is null or coalesce(cardinality(p_financial_ledger_ids), 0) = 0 then
    raise exception 'A captain and at least one wage record are required' using errcode = '22023';
  end if;

  select count(*) into v_unique_count
  from (select distinct unnest(p_financial_ledger_ids) as id) ids;

  if v_unique_count <> cardinality(p_financial_ledger_ids) then
    raise exception 'A wage record cannot be selected more than once' using errcode = '22023';
  end if;

  if v_notes is not null and length(v_notes) > 500 then
    raise exception 'Payout notes must be 500 characters or fewer' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_captain_id and role = 'captain'::public.app_role
  ) then
    raise exception 'Payouts can only be recorded for a captain' using errcode = '22023';
  end if;

  for v_ledger in
    select *
    from public.financial_ledger
    where id = any(p_financial_ledger_ids)
    order by created_at asc
    for update
  loop
    if v_ledger.captain_id <> p_captain_id then
      raise exception 'Every selected wage record must belong to the same captain' using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.captain_payout_items
      where financial_ledger_id = v_ledger.id
    ) then
      raise exception 'A selected wage record has already been paid' using errcode = '22023';
    end if;

    v_selected_count := v_selected_count + 1;
    v_total := v_total + v_ledger.captain_amount;
  end loop;

  if v_selected_count <> cardinality(p_financial_ledger_ids) then
    raise exception 'One or more selected wage records were not found' using errcode = 'P0002';
  end if;

  insert into public.captain_payouts (
    captain_id,
    total_amount,
    paid_by_user_id,
    notes
  )
  values (
    p_captain_id,
    v_total,
    (select auth.uid()),
    v_notes
  )
  returning * into v_payout;

  insert into public.captain_payout_items (
    payout_id,
    financial_ledger_id,
    captain_amount
  )
  select
    v_payout.id,
    fl.id,
    fl.captain_amount
  from public.financial_ledger fl
  where fl.id = any(p_financial_ledger_ids);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    'captain_payout_recorded',
    'captain_payout',
    v_payout.id,
    jsonb_build_object(
      'captain_id', p_captain_id,
      'total_amount', v_payout.total_amount,
      'financial_ledger_count', v_selected_count
    )
  );

  return v_payout;
end;
$$;

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
  select
    coalesce(sum(fl.gross_fee), 0)::numeric,
    coalesce(sum(fl.captain_amount), 0)::numeric,
    coalesce(sum(fl.company_amount), 0)::numeric,
    coalesce(sum(fl.settlement_amount), 0)::numeric,
    coalesce(sum(case when cpi.financial_ledger_id is not null then fl.captain_amount else 0 end), 0)::numeric,
    coalesce(sum(case when cpi.financial_ledger_id is null then fl.captain_amount else 0 end), 0)::numeric
  from public.financial_ledger fl
  left join public.captain_payout_items cpi
    on cpi.financial_ledger_id = fl.id;
end;
$$;

create or replace function private.get_captain_wage_summary(
  p_captain_id uuid default null
)
returns table (
  captain_id uuid,
  captain_name text,
  order_count bigint,
  gross_total numeric,
  captain_net_total numeric,
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
  select
    fl.captain_id,
    p.full_name,
    count(*)::bigint,
    coalesce(sum(fl.gross_fee), 0)::numeric,
    coalesce(sum(fl.captain_amount), 0)::numeric,
    coalesce(sum(case when cpi.financial_ledger_id is not null then fl.captain_amount else 0 end), 0)::numeric,
    coalesce(sum(case when cpi.financial_ledger_id is null then fl.captain_amount else 0 end), 0)::numeric
  from public.financial_ledger fl
  join public.profiles p on p.id = fl.captain_id
  left join public.captain_payout_items cpi on cpi.financial_ledger_id = fl.id
  where p_captain_id is null or fl.captain_id = p_captain_id
  group by fl.captain_id, p.full_name
  order by p.full_name nulls last, fl.captain_id;
end;
$$;

create or replace function private.get_captain_wage_details(
  p_captain_id uuid
)
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
  payout_id uuid,
  paid_at timestamptz
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
    cpi.payout_id,
    cp.paid_at
  from public.financial_ledger fl
  join public.orders o on o.id = fl.order_id
  left join public.captain_payout_items cpi on cpi.financial_ledger_id = fl.id
  left join public.captain_payouts cp on cp.id = cpi.payout_id
  where fl.captain_id = p_captain_id
  order by coalesce(o.completed_at, o.false_order_at) desc, fl.created_at desc;
end;
$$;

create or replace function public.create_captain_payout(
  p_captain_id uuid,
  p_financial_ledger_ids uuid[],
  p_notes text default null
)
returns public.captain_payouts
language sql
security invoker
set search_path = ''
as $$
  select private.create_captain_payout(p_captain_id, p_financial_ledger_ids, p_notes)
$$;

create or replace function public.get_wage_totals()
returns table (
  gross_total numeric,
  captain_net_total numeric,
  company_total numeric,
  settlement_total numeric,
  paid_total numeric,
  unpaid_total numeric
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_wage_totals()
$$;

create or replace function public.get_captain_wage_summary(
  p_captain_id uuid default null
)
returns table (
  captain_id uuid,
  captain_name text,
  order_count bigint,
  gross_total numeric,
  captain_net_total numeric,
  paid_total numeric,
  unpaid_total numeric
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_captain_wage_summary(p_captain_id)
$$;

create or replace function public.get_captain_wage_details(
  p_captain_id uuid
)
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
  payout_id uuid,
  paid_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_captain_wage_details(p_captain_id)
$$;

revoke all on function private.create_captain_payout(uuid, uuid[], text) from public, anon;
revoke all on function private.get_wage_totals() from public, anon;
revoke all on function private.get_captain_wage_summary(uuid) from public, anon;
revoke all on function private.get_captain_wage_details(uuid) from public, anon;

grant execute on function private.create_captain_payout(uuid, uuid[], text) to authenticated;
grant execute on function private.get_wage_totals() to authenticated;
grant execute on function private.get_captain_wage_summary(uuid) to authenticated;
grant execute on function private.get_captain_wage_details(uuid) to authenticated;

revoke all on function public.create_captain_payout(uuid, uuid[], text) from public, anon;
revoke all on function public.get_wage_totals() from public, anon;
revoke all on function public.get_captain_wage_summary(uuid) from public, anon;
revoke all on function public.get_captain_wage_details(uuid) from public, anon;

grant execute on function public.create_captain_payout(uuid, uuid[], text) to authenticated;
grant execute on function public.get_wage_totals() to authenticated;
grant execute on function public.get_captain_wage_summary(uuid) to authenticated;
grant execute on function public.get_captain_wage_details(uuid) to authenticated;
