-- Delivery Tartous: core data schema only.
-- This migration deliberately contains no RLS policies, RPC functions, Auth triggers,
-- sample accounts, or sample orders. Those are introduced in later reviewed migrations.

create type public.app_role as enum ('admin', 'supervisor', 'captain');
create type public.captain_availability as enum ('available', 'unavailable');
create type public.order_status as enum (
  'pending',
  'assigned',
  'received',
  'in_delivery',
  'completed',
  'cancelled',
  'false_order'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.app_role not null default 'captain',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_normalized check (email = lower(email))
);

create table public.permissions (
  code text primary key,
  description text not null,
  created_at timestamptz not null default now(),
  constraint permissions_code_format check (code ~ '^[a-z][a-z0-9_]*$')
);

create table public.role_permissions (
  role public.app_role not null,
  permission_code text not null references public.permissions(code) on delete cascade,
  is_allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role, permission_code)
);

create table public.user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  is_allowed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_code)
);

create table public.captain_status (
  captain_id uuid primary key references public.profiles(id) on delete cascade,
  availability public.captain_availability not null default 'unavailable',
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  customer_phone text not null,
  pickup_address text not null,
  delivery_address text not null,
  fee numeric(12, 2) not null check (fee > 0),
  status public.order_status not null default 'pending',
  assigned_captain_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  cancellation_reason text,
  assigned_at timestamptz,
  received_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  false_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_cancellation_reason_not_blank check (
    cancellation_reason is null or length(trim(cancellation_reason)) > 0
  )
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status public.order_status,
  next_status public.order_status not null,
  changed_by_user_id uuid references public.profiles(id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);

create table public.financial_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  captain_id uuid not null references public.profiles(id) on delete restrict,
  source_status public.order_status not null check (source_status in ('completed', 'false_order')),
  gross_fee numeric(12, 2) not null check (gross_fee > 0),
  captain_amount numeric(12, 2) not null check (captain_amount >= 0),
  company_amount numeric(12, 2) not null check (company_amount >= 0),
  settlement_amount numeric(12, 2) not null check (settlement_amount >= 0),
  created_at timestamptz not null default now(),
  constraint financial_ledger_amounts_balance check (
    captain_amount + company_amount + settlement_amount = gross_fee
  ),
  constraint financial_ledger_delivery_split check (
    (source_status = 'completed'
      and captain_amount = round(gross_fee * 0.70, 2)
      and company_amount = gross_fee - captain_amount
      and settlement_amount = 0)
    or
    (source_status = 'false_order'
      and captain_amount = round(gross_fee * 0.70, 2)
      and company_amount = 0
      and settlement_amount = gross_fee - captain_amount)
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (length(trim(action)) > 0),
  constraint audit_logs_entity_type_not_blank check (length(trim(entity_type)) > 0)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_role_permissions_updated_at
before update on public.role_permissions
for each row execute procedure public.set_updated_at();

create trigger set_user_permission_overrides_updated_at
before update on public.user_permission_overrides
for each row execute procedure public.set_updated_at();

create trigger set_orders_updated_at
before update on public.orders
for each row execute procedure public.set_updated_at();

create index orders_status_created_at_idx
  on public.orders (status, created_at desc);

create index orders_assigned_captain_status_idx
  on public.orders (assigned_captain_id, status, created_at desc);

create index orders_created_by_created_at_idx
  on public.orders (created_by_user_id, created_at desc);

create index order_status_history_order_changed_at_idx
  on public.order_status_history (order_id, changed_at desc);

create index financial_ledger_captain_created_at_idx
  on public.financial_ledger (captain_id, created_at desc);

create index financial_ledger_source_status_idx
  on public.financial_ledger (source_status);

create index audit_logs_actor_created_at_idx
  on public.audit_logs (actor_user_id, created_at desc);

create index audit_logs_entity_created_at_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

comment on table public.profiles is 'Application profile linked one-to-one to Supabase Auth users.';
comment on table public.permissions is 'Permission catalog; values are seeded in the authorization migration.';
comment on table public.role_permissions is 'Role-to-permission matrix; policies will read it in a later migration.';
comment on table public.user_permission_overrides is 'Per-user permission overrides, used to restrict or grant a specific user beyond their role defaults.';
comment on table public.captain_status is 'Current availability of a captain.';
comment on table public.orders is 'Delivery order lifecycle records.';
comment on table public.order_status_history is 'Append-only history of order status changes.';
comment on table public.financial_ledger is 'One final settlement per completed or false order.';
comment on table public.audit_logs is 'Administrative audit trail.';
