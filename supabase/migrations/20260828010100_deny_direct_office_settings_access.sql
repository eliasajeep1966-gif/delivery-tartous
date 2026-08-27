-- Direct table access is intentionally denied. The authenticated RPCs in the
-- previous migration enforce permissions before accessing this singleton row.
drop policy if exists office_settings_no_direct_access on public.office_settings;
create policy office_settings_no_direct_access
on public.office_settings
for all
to authenticated
using (false)
with check (false);
