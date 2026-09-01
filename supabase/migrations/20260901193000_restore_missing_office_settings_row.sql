-- Ensure the singleton office settings row exists after migrations or data loss.
-- This is intentionally idempotent and never overwrites an existing configuration.
insert into public.office_settings (
  id,
  office_name,
  office_phone,
  office_address,
  captain_share,
  office_share,
  distribution_exceptions
)
values (
  true,
  'دليفري طرطوس',
  '0933000000',
  'طرطوس — مركز المدينة',
  70,
  30,
  '[]'::jsonb
)
on conflict (id) do nothing;

comment on table public.office_settings is
  'Singleton persisted office configuration; the row with id=true must always exist.';

revoke all on table public.office_settings from public, anon, authenticated;
